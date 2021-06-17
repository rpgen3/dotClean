(async()=>{
    await import('https://rpgen3.github.io/lib/lib/jquery-3.5.1.min.js');
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
    let img;
    $('<input>').appendTo(h).prop({
        type: "file"
    }).on('change',e => {
        img = new Image();
        img.src = URL.createObjectURL(e.target.files[0]);
    });
    $('<button>').appendTo(h).text('処理').on('click', main);
    const output = $('<div>').appendTo(h);
    const main = () => {
        if(!img) msg('you must input file', true);
        const {width, height} = img,
              cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        ctx.drawImage(img, 0, 0);
        const {data} = ctx.getImageData(0, 0, width, height),
              mass = toMass(data, width, height);
        makeCanvas(mass, unit).appendTo(output.empty());
    };
    const toMass = (data, width, height) => new Array(height).fill().map((v,y)=>new Array(width).fill().map((v,x)=>{
        const i = x + y * width;
        return data.slice(i, i + 3).join('#');
    }));
    const mode = arr => { // 最頻値
        const map = new Map();
        for(const v of arr) map.set(arr.filter(v2=>v2===v).length, v);
        return map.get(Math.max(...map.keys()));
    };
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
