const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const WavEncoder = require('wav-encoder');
const fs = require('fs');
const app = express();
const speech = require('@google-cloud/speech');


/* *********************************************************
HTTP サーバを起動
********************************************************* */
app.use('/', express.static(path.join(__dirname, 'public')))
server = http.createServer(app).listen(3000, function() {
    console.log('処理順：01 -> HTTP サーバを起動');
    console.log('Example app listening on port 3000');
});

/* *********************************************************
サーバー起動
クライアントが接続したときの処理
　└　録音開始の合図を受け取ったときの処理
　└　PCMデータを受信したときの処理
　　 ※PCMデータ -> アナログでータをデジタルデータへ変換
　└　録音停止の合図を受け取ったときの処理
********************************************************* */

// WebSocket サーバを起動
const io = socketio(server);

// クライアントが接続したときの処理
io.on('connection', (socket) => {

    let sampleRate = 48000;
    let buffer = [];

    // 録音開始の合図を受け取ったときの処理
    socket.on('start', (data) => {
        sampleRate = data.sampleRate
    });

    // PCMデータを受信したときの処理
    socket.on('send_pcm', (data) => {
        const itr = data.values()
        const buf = new Array(data.length)
        for (var i = 0; i < buf.length; i++) {
            buf[i] = itr.next().value
        }
        buffer = buffer.concat(buf);
    });

    // 録音停止の合図を受け取ったときの処理
    socket.on('stop', async(data, ack) => {
        // Float32Array に変換（AudioBufferが扱いやすいようにFloat32Arrayとしてアクセスできるように変換）
        const f32array = await toF32Array(buffer);
        // 音声データをテキスト化（speech to text）
        const convertedAudioData = await transcribeAudio(f32array, sampleRate);
        // データが届いたことの確認、兼、追加データをレンダーJSに送信
        ack({ filename: convertedAudioData[0].results.map(r=>r.alternatives[0].transcript).join('\n') });
        // bufferの初期化
        buffer = [];
    });
});


// Convert byte array to Float32Array
const toF32Array = (buf) => {
    const buffer = new ArrayBuffer(buf.length);
    const view = new Uint8Array(buffer);
    for (var i = 0; i < buf.length; i++) {
        view[i] = buf[i]
    }
    return new Float32Array(buffer);
};


/********************************************
speech to text の実行 ※以下のソースコードでテキスト化を確認
******************************************** */

//アプリの資格情報の取得（環境設定変数）
process.env.GOOGLE_APPLICATION_CREDENTIALS='APIKEY（jsondata）';

async function transcribeAudio(audiofile, sampleRate){

  try{
    const speechClient = new speech.SpeechClient();
    const audioData = {
        sampleRate: sampleRate,
        channelData: [audiofile]
    };

    // オーディオデータをwav形式に変換
    let wavEncodedData = await WavEncoder.encode(audioData).then((buffer) => {
      return Buffer.from(buffer);
    });

    // wavデータをBase64に変換 => Base64に変換とは？
    const audioBytes = wavEncodedData.toString('base64');

    const audio = {
      content: audioBytes
    };

    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 48000,
      audioChannelCount: 1,
      languageCode: 'ja-JP',
    };

    return new Promise((resolve, rejects) => {
      //音声データをGCPへ送信 => 応答結果を「resolve」で返却
      speechClient.recognize({audio, config})
      .then(wavEncodedData => {
        resolve(wavEncodedData);
      })
      .catch(error => {
        reject(error);
      })

    })} catch (error) {
      console.log('catchERRORが発生');
      console.log('ERROR', error);
  }

};

