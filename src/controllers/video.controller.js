import mongoose, { isValidObjectId } from "mongoose";
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
  const thumbNailLocalPath = req.files?.thumbNail[0].path;

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
      url: videoFile.url,
    },
    thumbNail: {
      url: thumbNail.url,
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

const getAllVideos = asyncHandler(async (req, res) => {});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  let userId = req.body;

  if(!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid VideoId");
  }

  if(!isValidObjectId(req.user?._id)) {
    throw new apiError(400, "Invalid userId");
  }

  const video = await Video.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(videoId)
        }
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes"
        }
      },
      {
        $lookup: {
          from: "user",
          localField: "owner",
          foreignField: "_id",
          as: "Owner",
          pipeline: [
            {
              $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
              }
            },
            {
              $addFields: {
                susbscribersCount: {
                  $size: "$subscibers"
                },
                isSubscribed: {
                  $code: {
                    if: {
                      $in: [
                        req.user?._id,
                        "subscribers.subscriber"
                      ]
                    },
                    then: true,
                    else: false
                  }
                }
              }
            },
            {
              $project: {
                username: 1,
                "avatar.url": 1,
                subscribersCount: 1,
                isSubscribed: 1
              }
            }
          ]
        }
      },
      {
        $addFields: {
          likesCount: {
            $size: "$likes"
          },
          owner: {
            $first: "$owner"
          },
          isLiked: {
            $cond: {
              if: {$in: [req.user?._id, "$likes.likedBy"]},
              then: true,
              else: false
            }
          }
        }
      },
      {
        $project: {
          "videoFile.url": 1,
          title: 1,
          description: 1,
          views: 1,
          createdAt: 1,
          duration: 1,
          comments: 1,
          owner: 1,
          likesCount: 1,
          isLiked: 1
        }
      }
  ]);
  
  if(!video) {
    throw new apiError(500, "failed to fetch video");
  }

  // increment views if video fetched successfully
  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1
    }
  });

  //add this video to user watch history
  await User.findByIdAndUpdate(req.user?._id, {
    $addFields: {
      watchHistory: videoId
    }
  });

  return res.status(200).json(
    new apiResponse(200, video[0], "video details fetched successfully")
  );
  
});

export { 
  uploadVideo,
  getAllVideos,
  getVideoById
};
