import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { apiError } from "../utils/apiError.js";
import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { isValidObjectId } from "mongoose";

//upload video
const uploadVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new apiError(400, "All fields are required");
  }

  const videoFileLocalPath = req.files?.videoFile[0].path;
  const thumbNailLocalPath = req.files?.thumbNail[0].path;

  if (!videoFileLocalPath) throw new apiError(400, "VideoPath is required");
  if (!thumbNailLocalPath) throw new apiError(400, "ThumNailPath is required");

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbNail = await uploadOnCloudinary(thumbNailLocalPath);

  if (!videoFile) throw new apiError(400, "Video file not found");
  if (!thumbNail) throw new apiError(400, "ThumbNail not found");

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: videoFile.url,
    thumbNail: thumbNail.url,
    owner: req.user?._id,
    isPublished: false,
  });

  const videoUploaded = await Video.findById(video._id);
  if (!videoUploaded)
    throw new apiError(500, "Video-Upload failed, please try again!!!");

  return res
    .status(200)
    .json(new apiResponse(200, video, "Video uploaded successfully"));
});

//update the details of video (title, description, thumbnail)
const updateVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) throw new apiError(400, "Invalid videoId");
  if (!(title && description))
    throw new apiError(400, "title and description are required");

  const video = await Video.findById(videoId);
  if (!video) throw new apiError(404, "video not found");

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new apiError(
      400,
      "You can't edit this video, as you are not the owner"
    );
  }

  //updating with new thumbNail
  const thumbNailLocalPath = req.file?.path;
  if (!thumbNailLocalPath) throw new apiError(400, "ThumbNail is required");

  const thumbNail = await uploadOnCloudinary(thumbNailLocalPath);
  if (!thumbNail) throw new apiError(400, "ThumbNail not found");

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbNail: thumbNail.url,
      },
    },
    { new: true }
  );

  if (!updatedVideo)
    throw new apiError(500, "Failed to update video details, please try again");

  return res
    .status(200)
    .json(new apiResponse(200, updatedVideo, "Video Updated Successfully"));
});

export { uploadVideo, updateVideo };
