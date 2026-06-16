const prisma = require("../config/prisma");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


//----------------------------------------------------
// CREATE JWT TOKEN
//----------------------------------------------------
const createToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};


//----------------------------------------------------
// COOKIE SETTER
//----------------------------------------------------
const sendAuthCookie = (res, token) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};


//----------------------------------------------------
// SIGNUP
//----------------------------------------------------
const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // check user exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: "user"
            }
        });

        const token = createToken(newUser);
        sendAuthCookie(res, token);

        return res.status(201).json({
            success: true,
            message: "Signup successful",
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {
        console.log("Signup Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


//----------------------------------------------------
// LOGIN
//----------------------------------------------------
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password required"
            });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = createToken(user);
        sendAuthCookie(res, token);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.log("Login Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


//----------------------------------------------------
// LOGOUT
//----------------------------------------------------
const logout = (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    });

    return res.status(200).json({
        success: true,
        message: "Logout successful"
    });
};


//----------------------------------------------------
// PROFILE
//----------------------------------------------------
const profile = async (req, res) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: Number(userId) },
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.log("Profile Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


//----------------------------------------------------
// EXPORT
//----------------------------------------------------
module.exports = {
    signup,
    login,
    logout,
    profile
};