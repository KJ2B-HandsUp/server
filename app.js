import express from "express";
import http from "http";
import path from "path";
import bodyParser from 'body-parser';
import { Server } from "socket.io";
import mediasoup from 'mediasoup';
import cors from "cors";
import routes from "./routers/router.js";
import { config } from 'dotenv';
import AWS from 'aws-sdk';
import qs from "qs";
import axios from "axios";
import session from "express-session";

// config();

// AWS SDK를 DynamoDB Local에 연결하기 위해 endpoint를 설정합니다.
AWS.config.update({
    region: "ap-northeast-2", // 지역(region)은 local로 설정합니다.
    accessKeyId: "AKIAQAOWDSHMLK33KPPE", // 로컬 환경에서 더미(dummy) 액세스 키를 사용합니다.
    secretAccessKey: "bw1SZ0f00X02nJV4mYJycYgOaUyCJs9B/rD+YI7f", // 로컬 환경에서 더미(dummy) 시크릿 액세스 키를 사용합니다.
});

//변수 설정
let worker;
let workers = [];
let peers = {};
let transports = [];
let producers = [];
let consumers = [];
let gameMode;
let rooms = {};

// 로그인 추가
const client_id = 'd6fa349547eacf261bb84a056266706d';
const redirect_uri = 'http://localhost:3000/redirect';
const token_uri = 'https://kauth.kakao.com/oauth/token';
const api_host = "https://kapi.kakao.com";
const client_secret = '';
const docClient = new AWS.DynamoDB.DocumentClient();

const __dirname = path.resolve();
const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// 로그인
app.use(session({
    secret: 'your session secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use("/", routes(rooms, gameMode));
app.post("/testdata2", (req, res) => {
    const type = req.body;
    gameMode = type["selectedValue"];
})

// 서버, mediasoup 설정
const httpServer = http.createServer(app);
httpServer.listen(3000, () => {
    console.log("Listening on port: http://localhost:3000");
});

//cors 설정
const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

// 로컬 DynamoDB에 데이터를 추가하는 예제 함수
async function addItem(tableName, id_val, email_val) {
    const params = {
        TableName: tableName, // 로컬 DynamoDB 테이블 이름 (테이블은 미리 생성되어 있어야 합니다)
        Item: {
            user_id: id_val,
            user_email: email_val // 기본 키 필드 (해당 테이블의 기본 키에 맞게 설정해야 합니다)
        },
    };
    try {
        await docClient.put(params).promise();
        console.log("Item added successfully!");
        return true;
    } catch (err) {
        console.error("Error adding item:", err);
        return false;
    }
}

// 로컬 DynamoDB에 데이터를 조회하는 예제 함수
async function getItem(tableName, id_val, email_val) {
    const params = {
        TableName: tableName,
        Key: {
            user_id: id_val,
            user_email: email_val,
        },
    };
    try {
        const data = await docClient.get(params).promise();

        console.log("Item retrieved successfully:", data.Item);

        return true;
    } catch (err) {
        console.error("Error getting item:", err);

        return false;
    }
}

app.get('/kakaoLogin', (req, res) => {
    res.sendFile(__dirname + "/public/views/kakao/kakaoLogin.html");
});

// 확인받는 단계?
app.get('/authorize', (req, res) => {
    let { scope } = req.query;
    var scopeParam = "";
    if (scope) {
        scopeParam = "&scope=" + scope;
    }
    res.status(302).redirect(`https://kauth.kakao.com/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=code${scopeParam}`);
})

// 유저 정보 받아오는 함수?
const call = async (method, uri, param, header) => {
    let rtn;
    try {
        rtn = await axios({
            method: method,
            url: uri,
            headers: header,
            data: param
        })
    } catch (err) {
        rtn = err.response;
    }
    return rtn.data;
}

let user_id;
let user_email;

// 로그인 완료 후 
app.get('/redirect', async (req, res) => {
    const param = qs.stringify({
        "grant_type": 'authorization_code',
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "client_secret": client_secret,
        "code": req.query.code
    });

    const header = { 'content-type': 'application/x-www-form-urlencoded' };
    var rtn = await call('POST', token_uri, param, header);
    req.session.key = rtn.access_token;
    res.status(302).redirect(`http://localhost:3000`);
    console.log(rtn);
});

// 프로필 조회
app.get('/profile', async (req, res) => {
    console.log("profile 눌렀음");
    const uri = api_host + "/v2/user/me";
    const param = {};
    const header = {
        'content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + req.session.key
    }
    var rtn = await call('POST', uri, param, header);
    res.send(rtn);
})


// 친구
app.get('/friends', async (req, res) => {
    const uri = api_host + "/v1/api/talk/friends";
    const param = null;
    const header = {
        'Authorization': 'Bearer ' + req.session.key
    }
    var rtn = await call('GET', uri, param, header);
    res.send(rtn);
})

// 문자보내기?
app.get('/message', async (req, res) => {
    const uri = api_host + "/v2/api/talk/memo/default/send";
    const param = qs.stringify({
        "template_object": '{' +
            '"object_type": "text",' +
            '"text": "텍스트 영역입니다. 최대 200자 표시 가능합니다.",' +
            '"link": {' +
            '    "web_url": "https://developers.kakao.com",' +
            '    "mobile_web_url": "https://developers.kakao.com"' +
            '},' +
            '"button_title": "바로 확인"' +
            '}'
    });
    const header = {
        'content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + req.session.key
    }
    var rtn = await call('POST', uri, param, header);
    res.send(rtn);
})

// 소켓 선언
const connections = io.of("/mediasoup");
const dataConnections = io.of("/data");

// Worker 생성 함수
const createWorker = async () => {
    worker = await mediasoup.createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 3000,
    })
    console.log(`worker pid ${worker.pid}`);

    worker.on("died", error => {
        console.error("mediasoup worker has died");
        setTimeout(() => process.exit(1), 2000);
    })
    worker.using = false;
    workers.push(worker);
    return worker;
}

// Worker 생성
for (let i = 0; i < 4; i++) {
    createWorker();
}

// 사용할 오디오 및 비디오 코덱 정의
const mediaCodecs = [
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
            "x-google-start-bitrate": 300,
            "max-fs": 3600,
            "max-br": 500
        },
    },
];

// peers 객체에서 소켓을 이용한 이벤트 처리
connections.on("connection", async socket => {
    console.log(socket.id);
    // 소켓 연결 성공
    socket.emit("connection-success", {
        socketId: socket.id,
    });

    const removeItems = (items, socketId, type) => {
        items.forEach(item => {
            if (item.socketId === socket.id) {
                item[type].close();
            }
        })
        items = items.filter(item => item.socketId !== socket.id);

        return items;
    }

    // 소켓 연결 종료
    socket.on("disconnect", () => {
        console.log("peer disconnected");

        consumers = removeItems(consumers, socket.id, "consumer");
        producers = removeItems(producers, socket.id, "producer");
        transports = removeItems(transports, socket.id, "transport");
        const peer = peers[socket.id];
        if (!peer) {
            return;
        }
        const { roomName } = peer;

        if (roomName && rooms[roomName]) {
            rooms[roomName].peers = rooms[roomName].peers.filter((socketId) => socketId !== socket.id);

            // 방에 접속한 인원이 1명만 남아 있는 경우
            if (rooms[roomName].peers.length === 0) {
                // 방 이름과 같은 worker의 router를 삭제
                for (const work of workers) {
                    let workList = Array.from(work.getRouters());
                    let router = workList.find((temp) => temp.room === roomName);
                    if (router) {
                        router.close();
                        console.log("삭제 후 router 개수:", work.getRouters().size);
                        break;
                    }
                }
                delete rooms[roomName]; // 방 삭제
            }
        }

        delete peers[socket.id];
        console.log("종료 후 방 목록:", rooms);
    });

    // 방에 입장시 joinRoom 이벤트 수신
    socket.on("joinRoom", async ({ roomName }, callback) => {
        const router1 = await createRoom(roomName, socket.id);

        peers[socket.id] = {
            socket,
            roomName,
            transports: [],
            producers: [],
            consumers: [],
            peerDetails: {
                name: '',
                isAdmin: false,
            }
        }
        console.log();
        console.log(rooms);
        for (const room in rooms) {
            const name = room;
            let roomLen = rooms[room].peers.length;

            console.log(`방 이름 : ${name}, 참여 인원 : ${roomLen} 명`);
        }

        const rtpCapabilities = router1.rtpCapabilities;

        workers.forEach(worker => {
            console.log(`${worker.pid}에 연결된 routers:`, worker.getRouters());
        })
        callback({ rtpCapabilities });
    });

    // transport 생성 이벤트 수신
    socket.on("createWebRtcTransport", async ({ consumer }, callback) => {
        const roomName = peers[socket.id].roomName;

        const router = rooms[roomName].router;

        createWebRtcTransport(router).then(
            transport => {
                callback({
                    params: {
                        id: transport.id,
                        iceParameters: transport.iceParameters,
                        iceCandidates: transport.iceCandidates,
                        dtlsParameters: transport.dtlsParameters,
                    }
                })

                addTransport(transport, roomName, consumer);
            },
            error => {
                console.log(error);
            });
    })

    // 공급자 정보 받기
    socket.on("getProducers", callback => {
        const { roomName } = peers[socket.id];

        let producerList = [];
        producers.forEach(producerData => {
            if (producerData.socketId !== socket.id && producerData.roomName === roomName) {
                producerList = [...producerList, producerData.producer.id];
            }
        })

        callback(producerList);
    })

    // 만들어진 transport 연결
    socket.on("transport-connect", ({ dtlsParameters }) => {
        console.log("DTLS PARAMS...", { dtlsParameters });
        getTransport(socket.id).connect({ dtlsParameters });
    })

    // 공급 속성의 transport 생성
    socket.on("transport-produce", async ({ kind, rtpParameters, appData }, callback) => {
        const producer = await getTransport(socket.id).produce({
            kind,
            rtpParameters,
        })

        if (!peers[socket.id]) {
            return;
        }

        const { roomName } = peers[socket.id];

        addProducer(producer, roomName);

        informConsumers(roomName, socket.id, producer.id);

        console.log("Producer ID: ", producer.id, producer.kind)

        producer.on("transportclose", () => {
            console.log("transport for this producer closed");
            producer.close();
        })

        callback({
            id: producer.id,
            producersExist: producers.length > 1 ? true : false
        })
    })


    // transport 수신 성공
    socket.on("transport-recv-connect", async ({ dtlsParameters, serverConsumerTransportId }) => {
        console.log(`DTLS PARAMS: ${dtlsParameters}`);
        const consumerTransport = transports.find(transportData => (
            transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport
        await consumerTransport.connect({ dtlsParameters });
    });

    // transport consume 성공
    socket.on("consume", async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId }, callback) => {
        try {
            const { roomName } = peers[socket.id];
            const router = rooms[roomName].router;
            let consumerTransport = transports.find(transportData => (
                transportData.consumer && transportData.transport.id == serverConsumerTransportId
            )).transport

            if (router.canConsume({
                producerId: remoteProducerId,
                rtpCapabilities
            })) {
                const consumer = await consumerTransport.consume({
                    producerId: remoteProducerId,
                    rtpCapabilities,
                    paused: true,
                })

                consumer.on("transportclose", () => {
                    console.log("transport close from consumer");
                })
                consumer.on("producerclose", () => {
                    console.log("producer of consumer closed");
                    socket.emit("producer-closed", { remoteProducerId });

                    consumerTransport.close([]);
                    transports = transports.filter(transportData => transportData.transport.id !== consumerTransport.id);
                    consumer.close();
                    consumers = consumers.filter(consumerData => consumerData.consumer.id !== consumer.id);
                });

                addConsumer(consumer, roomName);

                const params = {
                    id: consumer.id,
                    producerId: remoteProducerId,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                    serverConsumerId: consumer.id,
                }

                callback({ params });
            }
        } catch (error) {
            console.log(error.message);
            callback({
                params: {
                    error: error
                }
            })
        }
    })

    // transport consume 재개
    socket.on("consumer-resume", async ({ serverConsumerId }) => {
        console.log("consumer resume");
        const { consumer } = consumers.find(consumerData => consumerData.consumer.id === serverConsumerId);
        await consumer.resume();
    });

    // 함수 선언
    const createRoom = async (roomName, socketId) => {
        let router1;
        let peers = [];

        if (rooms[roomName]) {
            router1 = rooms[roomName].router;
            peers = rooms[roomName].peers || [];
            rooms[roomName] = {
                router: router1,
                peers: [...peers, socketId],
                roomType: rooms[roomName].roomType
            }
        } else {
            for (const worker of workers) {
                if (worker.getRouters().size < 4) {
                    worker.using = roomName;

                    router1 = await worker.createRouter({ mediaCodecs, });
                    router1["room"] = roomName;
                    break;
                }
            }

            rooms[roomName] = {
                router: router1,
                peers: [...peers, socketId],
                roomType: gameMode
            }
        }

        console.log(`Router ID: ${router1.id}`);

        return router1;
    }

    const addTransport = (transport, roomName, consumer) => {
        transports = [
            ...transports,
            { socketId: socket.id, transport, roomName, consumer, }
        ]

        peers[socket.id] = {
            ...peers[socket.id],
            transports: [
                ...peers[socket.id].transports,
                transport.id,
            ]

        }
    }

    const addProducer = (producer, roomName) => {
        producers = [
            ...producers,
            { socketId: socket.id, producer, roomName, }
        ]
        peers[socket.id] = {
            ...peers[socket.id],
            producers: [
                ...peers[socket.id].producers,
                producer.id,
            ]
        }
    }

    const addConsumer = (consumer, roomName) => {
        consumers = [
            ...consumers,
            { socketId: socket.id, consumer, roomName, }
        ]

        peers[socket.id] = {
            ...peers[socket.id],
            consumers: [
                ...peers[socket.id].consumers,
                consumer.id,
            ]
        }
    }

    const getTransport = (socketId) => {
        const [producerTransport] = transports.filter(transport => transport.socketId === socketId && !transport.consumer);
        return producerTransport.transport;
    }

    const informConsumers = (roomName, socketId, id) => {
        console.log(`just joined, id ${id} ${roomName}, ${socketId}`);

        producers.forEach(producerData => {
            if (producerData.socketId !== socketId && producerData.roomName === roomName) {
                const producerSocket = peers[producerData.socketId].socket;

                producerSocket.emit("new-producer", { producerId: id });
            }
        })
    }

    const createWebRtcTransport = async (router) => {
        return new Promise(async (resolve, reject) => {
            try {
                const webRtcTransport_options = {
                    listenIps: [
                        {
                            ip: '172.31.5.109', // replace with relevant IP address
                            announcedIp: '43.201.47.117',
                        }
                    ],
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                }
                // router 내장함수 createWebRtpTransport 함수를 실행
                let transport = await router.createWebRtcTransport(webRtcTransport_options);
                console.log(`transport id: ${transport.id}`);
    
                // transport 객체에 이벤트 핸들러 부착
                transport.on("dtlsstatechange", dtlsState => {
                    if (dtlsState === "closed") {
                        transport.close();
                    }
                });
    
                transport.on("close", () => {
                    console.log("transport closed");
                });
    
                resolve(transport);
            } catch (error) {
                reject(error);
            }
        })
    }
});


// data 소켓
dataConnections.on("connect", async socket => {
    console.log("data 소켓 연결");
    socket.emit("connection-success", {
        socketId: socket.id,
    });

    socket.on("get_game_data", (data) => {
        socket.broadcast.emit("send_game_data", {data },() => {
            console.log("success: send data")
        })
    })

    socket.on("disconnect", () => {
        console.log("data 소켓 연결 종료");
    });
})
