(async()=>{
    await Promise.all([
        'https://rpgen3.github.io/lib/lib/jquery-3.5.1.min.js',
        'https://yaju1919.github.io/lib/lib/diffColor.js',
    ].map(v=>import(v)));
    const rpgen3 = await Promise.all([
        'baseN',
        'css',
        'hankaku',
        'input',
        'random',
        'save',
        'url',
        'util',
        'strToImg'
    ].map(v=>import(`https://rpgen3.github.io/mylib/export/${v}.mjs`))).then(v=>Object.assign({},...v));
    const h = $('body').css({
        "text-align": "center",
        padding: "1em"
    });
    $("<h1>").appendTo(h).text('ドット絵を綺麗にする');
    const hMsg = $("<div>").appendTo(h);
    const msg = (str, isError) => $("<span>").appendTo(hMsg.empty()).text(str).css({
        color: isError ? 'red' : 'blue',
        backgroundColor: isError ? 'pink' : 'lightblue'
    });
    $('<button>').appendTo(h).text('処理').on('click', ()=>main());
    const inputNoise = rpgen3.addSelect(h,{
        label: 'ノイズ除去度',
        list: [2, 3, 4],
        value: 3
    });
    $('<input>').appendTo(h).prop({
        type: "file"
    }).on('change',e => {
        imgElm.prop('src', URL.createObjectURL(e.target.files[0]));
    });
    const inputImg = rpgen3.addInputStr(h,{
        label: '画像URL入力',
        value: 'https://i.imgur.com/MrOrXaY.png'
    });
    inputImg.elm.on('change', () => {
        rpgen3.findURL(inputImg.toString()).forEach(v => imgElm.prop('src', v));
    });
    const imgElm = $('<img>').appendTo(h).prop({
        crossOrigin: "anonymous"
    });
    inputImg.elm.trigger('change');
    const output = $('<div>').appendTo(h);
    const sleep = ms => new Promise(resolve=>setTimeout(resolve, ms));
    const dialog = async str => {
        msg(str);
        await sleep(100);
    };
    const main = async () => {
        const img = imgElm.get(0),
              {width, height} = img,
              cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        ctx.drawImage(img, 0, 0);
        const {data} = ctx.getImageData(0, 0, width, height);
        await dialog('エッジ検出します');
        const bin = laplacian(data, width, height);
        await dialog('エッジ検出完了。ノイズを取り除きます');
        cleanBin(bin, width, height);
        await dialog('ノイズを取り除きました');
        return toCv(binToCv(bin), width, height);
        const colors = modeColors(toJoin(mass).flat());
        for(const a of mass){
            for(const b of a){
                a[b] = nearest(colors.map(v=>v.split('#')), b);
            }
        }
        const unit = 2;
        makeCanvas(toJoin(mass), unit).appendTo(output.empty());
    };
    const luminance = ([r,g,b]) => r * 0.298912 + g * 0.586611 + b * 0.114478 | 0;
    const laplacian = (data, w, h) => {
        const index = (x,y) => x + y * w,
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
                sum += v * luminance(data.slice(j, j + 3));
            }
            if(0x80 < sum) d[index(x,y)] = 1;
        }
        return d;
    };
    const cleanBin = (bin, w, h) => {
        const index = (x,y) => x + y * w,
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
    const count = arr => {
        const map = new Map();
        for(const v of arr) map.set(v, map.has(v) ? map.get(v) + 1 : 1);
        return map;
    };
    const modeColors = (arr, color) => { // 色の出現数リストから上位だけを取得
        let border = 2,
            ar = [...count(arr)];
        while(ar.length > 20){
            ar = ar.filter(([k,v]) => v > border);
            border *= 2;
        }
        return ar.map(([k,v]) => k);
    };
    const nearest = (arr, value) => { // 最も近い色
        const map = new Map();
        for(const v of arr) map.set(window.diffColor(v, value), v);
        return map.get(Math.min(...map.keys()));
    };
    const mode = arr => [...count(arr)].reduce((acc, v) => acc[1] < v[1] ? v : acc, [0,0])[0]; // 最頻値
    const toCv = (data, width, height) => {
        const cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        ctx.putImageData(new ImageData(data, width, height), 0, 0);
        return cv.appendTo(output.empty());
    };
    const binToCv = bin => {
        const d = new Uint8ClampedArray(bin.length << 2);
        for(const [i,v] of bin.entries()){
            const j = i << 2;
            if(!v) d[j] = d[j + 1] = d[j + 2] = 255;
            d[j + 3] = 255;
        }
        return d;
    };
})();
