const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const pool = require("../config/database");

const router = express.Router();

function createReferralCode() {
    return crypto.randomBytes(5)
        .toString("hex")
        .toUpperCase();
}

router.post("/register", async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            referralCode
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All required fields are missing"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const existing = await pool.query(
            "SELECT id FROM users WHERE email=$1",
            [email.toLowerCase()]
        );

        if (existing.rows.length) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        let referredBy = null;

        if (referralCode) {
            const ref = await pool.query(
                "SELECT id FROM users WHERE referral_code=$1",
                [referralCode]
            );

            if (ref.rows.length) {
                referredBy = ref.rows[0].id;
            }
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const newReferralCode = createReferralCode();

        const result = await pool.query(
            `INSERT INTO users
            (name,email,password_hash,referral_code,referred_by)
            VALUES($1,$2,$3,$4,$5)
            RETURNING id,name,email,referral_code,role`,
            [
                name,
                email.toLowerCase(),
                passwordHash,
                newReferralCode,
                referredBy
            ]
        );

        const user = result.rows[0];

        await pool.query(
            "INSERT INTO wallets(user_id) VALUES($1)",
            [user.id]
        );

        res.status(201).json({
            success: true,
            message: "Registration successful",
            user
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email.toLowerCase()]
        );

        if (!result.rows.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Account is disabled"
            });
        }

        const valid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!valid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                referralCode: user.referral_code
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

module.exports = router;
