import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express(); 

app.use(cors());
app.use(cookieParser({
    origin: process.env.CORS_ORIGIN,
    Credential: true
}));

//data will come in multiple ways in server, it could be in json-formate, URL-formate..etc, 
//so below are the settings to follow best practices for recieving data in the backend.
app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"));
app.use(cookieParser());


//routes import
import userRouter from './routes/user.route.js'
import videoRouter from './routes/video.route.js'

//routes declaration
app.use('/api/v1/user', userRouter);
app.use('/api/v1/video', videoRouter);

export {app}; 