const express = require("express");
const pool = require("../config/database");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id,name,price,duration_days,description
             FROM packages
             WHERE active=true
             ORDER BY price ASC`
        );

        res.json({
            success: true,
            packages: result.rows
        });

    } catch {
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

router.post("/purchase/:id", authenticate, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const packageResult = await client.query(
            `SELECT *
             FROM packages
             WHERE id=$1 AND active=true
             FOR UPDATE`,
            [req.params.id]
        );

        if (!packageResult.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Package not found"
            });
        }

        const pkg = packageResult.rows[0];

        const walletResult = await client.query(
            `SELECT balance
             FROM wallets
             WHERE user_id=$1
             FOR UPDATE`,
            [req.user.id]
        );

        const balance = Number(walletResult.rows[0].balance);

        if (balance < Number(pkg.price)) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance"
            });
        }

        const endDate = new Date();

        endDate.setDate(
            endDate.getDate() + pkg.duration_days
        );

        const purchase = await client.query(
            `INSERT INTO user_packages
            (user_id,package_id,amount,end_date)
            VALUES($1,$2,$3,$4)
            RETURNING *`,
            [
                req.user.id,
                pkg.id,
                pkg.price,
                endDate
            ]
        );

        await client.query(
            `UPDATE wallets
             SET balance=balance-$1,
                 updated_at=CURRENT_TIMESTAMP
             WHERE user_id=$2`,
            [
                pkg.price,
                req.user.id
            ]
        );

        await client.query(
            `INSERT INTO transactions
            (user_id,type,amount,description)
            VALUES($1,$2,$3,$4)`,
            [
                req.user.id,
                "package_purchase",
                pkg.price,
                `Purchased ${pkg.name}`
            ]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Package activated",
            package: purchase.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Purchase failed"
        });

    } finally {
        client.release();
    }
});

module.exports = router;
