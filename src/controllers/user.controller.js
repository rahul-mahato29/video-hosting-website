import { User } from '../models/user.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js'

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for image, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in database
    // check for user creation
    // remove password and refresh-token field from response
    // return response

    const { username, email, fullName, password } = req.body;
    if ([username, email, fullName, password].some((field) => field?.trim() === ""))
        throw new apiError(400, "All fields are required");

    const userExist = User.findOne({
        $or: [{ username }, { email }]
    })
    if (userExist) throw new apiError(409, "User already exist");

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if(!avatarLocalPath) throw new apiError(400, "Avatar is required");  //avatar is mandatory

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar) throw new apiError(400, "Avatar is required");

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })
    
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if(!createdUser) throw new apiError(500, "Something went wrong while registering the user")

    return res.status(201).json(
        new apiResponse(200, createdUser, "User register successfully")
    )
});

export { registerUser };