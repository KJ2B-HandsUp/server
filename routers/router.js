import express from "express";
import { config } from "dotenv";
import path from "path";

config();

const router = express.Router();
const __dirname = path.resolve();

export default function createRoutes(rooms, gameMode){
    router.use("/", express.static(path.join(__dirname, "public/views/login")));
    router.use("/home", express.static(path.join(__dirname, "public/views/home")));
    router.use("/main", express.static(path.join(__dirname, "public/views/main")));
    router.use("/room/:roomName", express.static(path.join(__dirname, "public/views/room")));

    router.get('/testdata', (req, res) => {
        res.json(rooms);
    });

    return router;
}