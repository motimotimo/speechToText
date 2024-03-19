const socket = io.connect()
let processor = null
let localstream = null

let textBox = [];
let textBox_temp = [];


/* *********************************************************
getUserMedia を使用してマイクにアクセス
********************************************************* */

function startRecording() {

    console.log('start recording')

    //AudioContext オブジェクトを作成するとブラウザのウィンドウやタブ内でオーディオ処理を行うことが可能
    //例えば、新しい音声ファイルを作成し、リアルタイムで音声を変更したり、複数の音声を混ぜたりすることできる
    context = new window.AudioContext()
    socket.emit('start', { 'sampleRate': context.sampleRate })
    
    // getUserMedia を使用してマイクにアクセス
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
        
        localstream = stream
        const input = this.context.createMediaStreamSource(stream)
        processor = context.createScriptProcessor(4096, 1, 1)

        input.connect(processor)
        processor.connect(context.destination)

        // processor.onaudioprocess にコールバック関数を指定することで、リアルタイムに音声を取得
        processor.onaudioprocess = (e) => {
            const voice = e.inputBuffer.getChannelData(0)
            // send_pcm を指定してサーバに送信
            socket.emit('send_pcm', voice.buffer);
        }

    }).catch((e) => {
        console.log(e)
    })
}


/* *********************************************************
録音終了時には getUserMedia を停止させ、サーバに対して stop を送信
********************************************************* */

function stopRecording() {
    
    // 録音終了時には getUserMedia を停止させ、サーバに対して stop を送信
    processor.disconnect();
    
    processor.onaudioprocess = null;
    processor = null;
    localstream.getTracks().forEach((track) => {
        track.stop()
    });
    
    //メインプロセス（serverjs）でテキスト化されたデータを受信
    socket.emit('stop', '', (res) => {

        let textualTime = new Date();
        textualTime = textualTime.toLocaleString('ja-JP');

        textBox_temp.push(textualTime);
        textBox_temp.push(`${res.filename}`);
        textBox.push(textBox_temp);
        textBox_temp = [];

        // 生成したHTMLを入れておく変数
        let html_text = '';

        // テキスト化されたデータをブラウザへ描画
        for (let i = 0; i < textBox.length; i++) {
            console.log('レイヤー：　' + textBox[i]);
            let htmlParts_modalCartInItems =
                '<ul>' +
                '<li class="time">' + textBox[i][0] + ':</li>' +
                '<li class="txt">' + textBox[i][1] + '</li>' +
                '</ul>';
            html_text += htmlParts_modalCartInItems;
        };

        document.getElementById('speech-to-text-area').innerHTML = html_text;

    });
    
};