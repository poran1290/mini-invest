const express = require("express");

const pool = require("../config/database");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.get("/me", authenticate, async (req, res) => {
    try {
        const user = await pool.query(
            `SELECT id,name,email,referral_code,role,status,created_at
             FROM users
             WHERE id=$1`,
            [req.user.id]
        );

        const wallet = await pool.query(
            `SELECT balance
             FROM wallets
             WHERE user_id=$1`,
            [req.user.id]
        );

        const activePackages = await pool.query(
            `SELECT
                up.id,
                p.name,
                up.amount,
                up.start_date,
                up.end_date,
                up.status
             FROM user_packages up
             JOIN packages p ON p.id=up.package_id
             WHERE up.user_id=$1
             ORDER BY up.id DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            user: user.rows[0],
            wallet: wallet.rows[0],
            packages: activePackages.rows
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
