import dotenv from 'dotenv';
import connectDB from './db/index.js'
import { app } from './app.js';
const PORT = process.env.PORT || 8000;

dotenv.config({
    path: "./env"
});

connectDB().then(() => {
    app.on("Error", (error) => { console.log("Error : ", error) });
    app.listen(PORT, () => {
        console.log(`server is running at ${PORT}`);
    });
})
.catch((error) => {
    console.log("MongoDB connection failed !! ", error);
});
