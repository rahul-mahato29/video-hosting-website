import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { apiError } from "../utils/apiError.js";
import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const uploadVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if([title,description].some((field) => field?.trim() === "")) {
    throw new apiError(400, "All fields are required");
  }

  const videoFileLocalPath = req.files?.videoFile[0].path;
  const thumbNailLocalPath = req.files?.thumbNail[0].path;

  if(!videoFileLocalPath) throw new apiError(400, "VideoPath is required");
  if(!thumbNailLocalPath) throw new apiError(400, "ThumNailPath is required");

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbNail = await uploadOnCloudinary(thumbNailLocalPath);

  if(!videoFile) throw new apiError(400, "Video file not found");
  if(!thumbNail) throw new apiError(400, "ThumbNail not found");

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: videoFile.url,
    thumbNail: thumbNail.url,
    owner: req.user?._id,
    isPublished: false
  })

  const videoUploaded = await Video.findById(video._id);
  if(!videoUploaded) throw new apiError(500, "Video-Upload failed, please try again!!!");

  return res.status(200).json(new apiResponse(200, video, "Video uploaded successfully"));
});

export { uploadVideo };
