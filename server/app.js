// const express = require('express')
// const port = 3000; //3000번 포트
// const host = '0.0.0.0';
// const app = express();
// app.get('/', (req, res) => {
//   res.send('Hello World!')
// });
// app.listen(port, host);
// console.log('server start!')

import express from 'express'
const app = express()

import https from 'http'
import fs from 'fs'
import path from 'path'
const __dirname = path.resolve()

import { Server } from 'socket.io'

app.get('/',(req,res)=>{
  res.send('Hello from mediasoup app!')
})

app.use('/sfu',express.static(path.join(__dirname, 'public')))

const httpServer = https.createServer(app)
httpServer.listen(3000,() => {
  console.log('listening on port: ' + 3000)
})

const io = new Server(httpServer)

const peers = io.of('/mediasoup')

peers.on('connection',socket => {
  console.log(socket.io)
})