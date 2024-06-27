import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new mongoose.Schema({
    videoFile: {
        type: String,  //cloudinary
        required: true
    },
    thumbnail: {
        type: String,   //cloudinary
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String, 
        requried: true
    },
    duration: {
        type: Number,   //cloudinary
        requried: true
    },
    views: {
        type: Number,
        default: 0
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, {timestamps: true});

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);