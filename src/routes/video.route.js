import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { updateVideo, uploadVideo } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/upload-video").post(
  verifyJWT,
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbNail",
      maxCount: 1,
    },
  ]),
  uploadVideo
);

router.route("/update-video/:videoId").patch(verifyJWT, upload.single("thumbNail"), updateVideo);

export default router;
