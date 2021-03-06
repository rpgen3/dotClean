(async()=>{
    await Promise.all([
        'https://rpgen3.github.io/lib/lib/jquery-3.5.1.min.js'
    ].map(v=>import(v)));
    $.getScript('https://rpgen3.github.io/lib/lib/MedianCut.js');
    const rpgen3 = await Promise.all([
        'input',
        'sample',
        'url'
    ].map(v=>import(`https://rpgen3.github.io/mylib/export/${v}.mjs`))).then(v=>Object.assign({},...v));
    const h = $('body').css({
        "text-align": "center",
        padding: "1em"
    });
    $("<h1>").appendTo(h).text('ドット絵を綺麗にする');
    const msg = (()=>{
        const elm = $("<div>").appendTo(h);
        return (str, isError) => $("<span>").appendTo(elm.empty()).text(str).css({
            color: isError ? 'red' : 'blue',
            backgroundColor: isError ? 'pink' : 'lightblue'
        });
    })();
    $('<button>').appendTo(h).text('処理').on('click', ()=>main());
    const inputWidth = rpgen3.addInputNum(h,{
        label: '出力後の幅px(省略可)',
        value: 0,
        min: 0,
        max: 300
    });
    const inputNoise = rpgen3.addSelect(h,{
        label: 'ノイズ除去度',
        value: 3,
        list: [2, 3, 4]
    });
    const inputDiff = rpgen3.addInputNum(h,{
        label: '単位の補正値',
        save: true,
        value: 1,
        min: -3,
        max: 3
    });
    const inputColors = rpgen3.addSelect(h,{
        label: '色数',
        save: true,
        value: '32色',
        list: {
            '2色': 2,
            '3色': 3,
            '4色': 4,
            '5色': 5,
            '6色': 6,
            '7色': 7,
            '8色': 8,
            '16色': 16,
            '32色': 32,
            '64色': 64,
            '128色': 128,
            '256色': 256,
            '滅色しない': 0
        }
    });
    $('<h2>').appendTo(h).text('画像を読み込む(2通り)');
    $('<p>').appendTo(h).text('入力画像の端のドットは0.5だったりしませんか？1に合わせると高精度になります');
    $('<input>').appendTo(h).prop({
        type: "file"
    }).on('change',e => {
        imgElm.prop('src', URL.createObjectURL(e.target.files[0]));
        msg('ファイルから画像を読み込みました');
    });
    const inputURL = rpgen3.addInputStr(h,{
        label: '画像URL入力',
        value: 'https://i.imgur.com/IRQAYsN.png'
    });
    inputURL.elm.on('change', () => {
        const url = inputURL();
        if(rpgen3.getDomain(url).join('.') === 'i.imgur.com') {
            imgElm.prop('src', url);
            msg('Imgurから画像を読み込みました');
        }
        else msg('CORSのためi.imgur.comの画像しか使えません', true);
    });
    const imgElm = $('<img>').appendTo(h).prop({
        crossOrigin: "anonymous"
    });
    inputURL.elm.trigger('change');
    const output = $('<div>').appendTo(h);
    const sleep = ms => new Promise(resolve=>setTimeout(resolve, ms));
    const dialog = async str => {
        msg(str);
        await sleep(30);
    };
    const main = async () => {
        const img = imgElm.get(0),
              {width, height} = img,
              cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height),
              {data} = imgData;
        const unit = await (async w => {
            if(w) return width / w | 0;
            await dialog('エッジ検出します');
            const bin = LoG(data, width, height);
            await dialog('ノイズを削除します');
            cleanBin(bin, width, height);
            await dialog('単位を求めます');
            return calcUnit(bin, width, height);
        })(inputWidth());
        if(!unit) msg('単位が0なので描画できません', true);
        if(inputColors()) {
            await dialog(`${inputColors}色に減色します`);
            new window.TMedianCut(imgData, window.getColorInfo(imgData)).run(inputColors, true);
        }
        await dialog('描画します');
        const [dd, ww, hh] = await draw(data, width, height, unit);
        await dialog('完成☆');
        toCv(dd, ww, hh);
    };
    const luminance = (r, g, b) => r * 0.298912 + g * 0.586611 + b * 0.114478 | 0;
    const LoG = (data, w, h) => {
        const index = (x, y) => x + y * w,
              d = new Uint8ClampedArray(data.length >> 2),
              kernel = [
                  0, 0, 1, 0, 0,
                  0, 1, 2, 1, 0,
                  1, 2, -16, 2, 1,
                  0, 1, 2, 1, 0,
                  0, 0, 1, 0, 0,
              ],
              size = Math.sqrt(kernel.length),
              p = size >> 1;
        for(let i = 0; i < data.length; i += 4){
            const x = (i >> 2) % w,
                  y = (i >> 2) / w | 0;
            if(x < p || y < p || x >= w - p || y >= h - p) continue;
            const rgb = data.slice(i, i + 3);
            let sum = 0;
            for (const [i,v] of kernel.entries()) {
                const xx = i % size,
                      yy = i / size | 0,
                      j = index(x + xx - p, y + yy - p) << 2;
                sum += v * luminance(...data.slice(j, j + 3));
            }
            if(0x80 < sum) d[index(x,y)] = 1;
        }
        return d;
    };
    const cleanBin = (bin, w, h) => {
        const index = (x, y) => x + y * w,
              p = 1,
              noise = inputNoise();
        for(const [i,v] of bin.entries()){
            if(!v) continue;
            const x = i % w,
                  y = i / w | 0;
            if(x < p || y < p || x >= w - p || y >= h - p) continue;
            const j = index(x - 1, y - 1),
                  k = index(x - 1, y),
                  l = index(x - 1, y + 1),
                  sum = [
                      ...bin.slice(j, j + 3),
                      bin[k],
                      bin[k + 2],
                      ...bin.slice(l, l + 3)
                  ].reduce((p,x) => p + x);
            if(sum < noise) bin[index(x, y)] = 0;
        }
    };
    const calcUnit = (bin, w, h) => {
        const index = (x, y) => x + y * w,
              ar = [];
        for(const bool of [0, 1]){
            for(let y = 0; y < h; y++){
                let min = Infinity,
                    flag = true,
                    last = 0;
                for(let x = 0; x < w; x++){
                    if(!bin[bool ? index(x, y) : index(y, x)]) continue;
                    if(flag) {
                        flag = false;
                        const v = x - last - 1;
                        if(v < min && v > 1) min = v;
                    }
                    else {
                        flag = true;
                        last = y;
                    }
                }
                ar.push(min);
            }
        }
        const max = Math.min(w, h);
        return rpgen3.mode(ar.filter(v => v < max)) + inputDiff;
    };
    const draw = async (data, w, h, unit) => {
        const ww = w / unit | 0,
              hh = h / unit | 0,
              index = (x, y) => x + y * w,
              d = new Uint8ClampedArray(ww * hh << 2);
        for(let i = 0; i < d.length; i += 4){
            const x = (i >> 2) % ww,
                  y = (i >> 2) / ww | 0,
                  ar = [],
                  map = new Map;
            for(let ii = 0, max = unit * unit; ii < max; ii++){
                const xx = ii % unit,
                      yy = ii / unit | 0,
                      j = index(unit * x + xx, unit * y + yy) << 2,
                      rgb = data.slice(j, j + 3),
                      lum = luminance(...rgb);
                ar.push(lum);
                map.set(lum, rgb);
            }
            const [r, g, b] = map.get(rpgen3.median(ar));
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = 255;
            x || await dialog(`描画中…(${y}/${hh})`);
        }
        return [d, ww, hh];
    };
    const toCv = (data, width, height) => {
        const cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        ctx.putImageData(new ImageData(data, width, height), 0, 0);
        return cv.appendTo(output.empty());
    };
})();
