const express = require("express");
const authenticate = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const pool = require("../config/database");

const router = express.Router();

// Example admin route: get basic stats
router.get("/stats", authenticate, adminOnly, async (req, res) => {
    try {
        const users = await pool.query("SELECT COUNT(*) as count FROM users");
        const packages = await pool.query("SELECT COUNT(*) as count FROM packages");

        res.json({
            success: true,
            stats: {
                users: users.rows[0].count,
                packages: packages.rows[0].count
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
