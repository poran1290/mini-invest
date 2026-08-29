const express = require("express");

const pool = require("../config/database");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
    try {
        const wallet = await pool.query(
            `SELECT balance
             FROM wallets
             WHERE user_id=$1`,
            [req.user.id]
        );

        const transactions = await pool.query(
            `SELECT id,type,amount,description,created_at
             FROM transactions
             WHERE user_id=$1
             ORDER BY id DESC
             LIMIT 50`,
            [req.user.id]
        );

        res.json({
            success: true,
            balance: wallet.rows[0]?.balance || 0,
            transactions: transactions.rows
        });

    } catch {
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

module.exports = router;
