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
    $('<input>').appendTo(h).prop({
        type: "file"
    }).on('change',e => {
        imgElm.prop('src', URL.createObjectURL(e.target.files[0]));
    });
    const inputImg = rpgen3.addInputStr(h,{
        label: '画像URL入力',
        save: true,
        value: 'https://i.imgur.com/MrOrXaY.png'
    });
    inputImg.elm.on('change', () => {
        rpgen3.findURL(inputImg.toString()).forEach(v => imgElm.prop('src', v));
    });
    const imgElm = $('<img>').appendTo(h).prop({
        crossOrigin: "anonymous"
    });
    inputImg.elm.trigger('change');
    $('<button>').appendTo(h).text('処理').on('click', ()=>main());
    const output = $('<div>').appendTo(h);
    const main = () => {
        const img = imgElm.get(0),
              {width, height} = img,
              cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        ctx.drawImage(img, 0, 0);
        const {data} = ctx.getImageData(0, 0, width, height),
              mass = toMass(data, width, height);
        const colors = modeColors(toJoin(mass).flat(), 10);
        for(const a of mass){
            for(const b of a){
                a[b] = nearest(colors.map(v=>v.split('#')), b);
            }
        }
        const unit = 2;
        makeCanvas(toJoin(mass), unit).appendTo(output.empty());
    };
    const toMass = (data, width, height) => new Array(height).fill().map((v,y)=>new Array(width).fill().map((v,x)=>{
        const i = x + y * width;
        return data.slice(i, i + 3);
    }));
    const toJoin = mass => mass.map(v=>v.map(v=>v.join('#')));
    const count = arr => {
        const map = new Map();
        for(const v of arr) map.set(v, map.has(v) ? map.get(v) + 1 : 1);
        return map;
    };
    const modeColors = (arr, border) => [...count(arr)].flatMap(([k, v]) => v < border ? k : []); // 色の出現数リストから上位だけを取得
    const nearest = (arr, value) => { // 最も近い色
        const map = new Map();
        for(const v of arr) map.set(window.diffColor(v, value), v);
        return map.get(Math.min(...map.keys()));
    };
    const mode = arr => [...count(arr)].reduce((acc, v) => acc[1] < v[1] ? v : acc, [0,0])[0]; // 最頻値
    const makeCanvas = (mass, unit) => {
        const width = Math.floor(mass[0].length / unit),
              height = Math.floor(mass.length / unit),
              cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                const [r,g,b] = mode(new Array(unit).fill().map((v,i)=>{
                    const idx = x * unit;
                    return mass[y * unit + i].slice(idx, idx + unit);
                }).flat()).split('#');
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
        return cv;
    };
})();
