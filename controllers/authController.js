const db = require("../db");
const bcrypt = require("bcrypt");

// Register
exports.register = async (req, res) => {

    const {
        username,
        firstName,
        lastName,
        email,
        phone,
        password
    } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            "INSERT INTO userrs(username,firstName,lastName,email,phone,password) VALUES(?,?,?,?,?,?)",
            [
                username,
                firstName,
                lastName,
                email,
                phone,
                hashedPassword
            ],
            (err, result) => {

                if (err) {
    console.log("REGISTER ERROR:", err);

    return res.json({
        success: false,
        message: err.sqlMessage || err.message
    });
}

                res.json({
                    success:true,
                    message:"Registration Successful."
                });

            }
        );

    } catch (err) {

        res.json({
            success:false,
            message:"Server Error"
        });

    }

};


// Login
exports.login = (req,res)=>{

    const {identifier,password}=req.body;

    db.query(

        "SELECT * FROM userrs WHERE username=? OR email=? OR phone=?",

        [identifier,identifier,identifier],

        async(err,result)=>{

            if(err){

                return res.json({
                    success:false,
                    message:"Database Error"
                });

            }

            if(result.length==0){

                return res.json({
                    success:false,
                    message:"User Not Found"
                });

            }

            const user=result[0];

            const match=await bcrypt.compare(password,user.password);

            if(!match){

                return res.json({
                    success:false,
                    message:"Wrong Password"
                });

            }

            res.json({

                success:true,

                user:{

                    username:user.username,

                    email:user.email,

                    name:user.firstName+" "+user.lastName,

                    initials:
                    user.firstName.charAt(0)+user.lastName.charAt(0)

                }

            });

        }

    );

};


// Forgot Password

exports.forgotPassword=(req,res)=>{

    const {identifier}=req.body;

    db.query(

        "SELECT * FROM users WHERE username=? OR email=? OR phone=?",

        [identifier,identifier,identifier],

        (err,result)=>{

            if(err){

                return res.json({

                    success:false,

                    message:"Database Error"

                });

            }

            if(result.length==0){

                return res.json({

                    success:false,

                    message:"Account Not Found"

                });

            }

            res.json({

                success:true,

                message:"Account Verified"

            });

        }

    );

};