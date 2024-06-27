import { Video } from "../models/video.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

//1. upload video
//2. get all videos
//3. access specific video by id
//4. update video details (title, description, thumbnail)
//5. delete video

const uploadVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new apiError(400, "All fields are required!");
  }

  const videoFileLocalPath = req.files?.videoFile[0].path;
  const thumbNailLocalPath = req.files?.videoFile[0].path;

  if (!videoFileLocalPath) {
    throw new apiError(400, "videoFileLocalPath is required");
  }

  if (!thumbNailLocalPath) {
    throw new apiError(400, "thumbNailLocalPath is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbNail = await uploadOnCloudinary(thumbNailLocalPath);

  if (!videoFile) {
    throw new apiError(400, "Video not found");
  }

  if (!thumbNail) {
    throw new apiError(400, "Thumbnail not found");
  }

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: {
        url: videoFile.url
    },
    thumbNail: {
        url: thumbNail.url
    },
    owner: req.user?._id,
    isPublished: true,
  });

  const videoUploaded = await Video.findById(video._id);
  if (videoUploaded) {
    throw new apiError(500, "VideoUploaded failed, please try again!!");
  }

  return res
    .status(200)
    .json(new apiResponse(200, "Video Uploaded Successfully"));
});


export {
    uploadVideo,
}