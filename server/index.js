const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const port = process.env.PORT || 8000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const nodemailer = require("nodemailer");
// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const usersCollection = client.db("stayVistaDB").collection("users");
    const roomsCollection = client.db("stayVistaDB").collection("rooms");
    const bookingsCollection = client.db("stayVistaDB").collection("bookings");
    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("I need a new jwt", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    //Get All room
    app.get("/rooms", async (req, res) => {
      try {
        const result = await roomsCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
        res.send(err.message);
      }
    });

    //Get single room by id
    app.get("/room/:id", async (req, res) => {
      try {
        const result = await roomsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (err) {
        console.log(err);
        res.send(err.message);
      }
    });

    //Get rooms for host
    app.get("/rooms/:email", async (req, res) => {
      try {
        const result = await roomsCollection
          .find({
            "host.email": req.params.email,
          })
          .toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
        res.send(err.message);
      }
    });

    // Get user Role
    app.get("/user/:email", async (req, res) => {
      try {
        const result = await usersCollection.findOne({
          email: req.params.email,
        });
        res.send(result);
      } catch (err) {
        console.log(err);
        res.send(err.message);
      }
    });

    //post new room
    app.post("/rooms", verifyToken, async (req, res) => {
      const newRoom = req.body;
      try {
        const result = await roomsCollection.insertOne(newRoom);

        res.send(result);
      } catch (err) {
        console.log(err);
        res.send(err.message);
      }
    });

    // Generate client secret for stripe payment
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      if (!price || amount < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: client_secret });
    });

    // Get all bookings for guest
    app.get("/bookings", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);
      const query = { "guest.email": email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });
    // Get all bookings for host
    app.get("/bookings/host", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);
      const query = { host: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // Save booking info in booking collection
    app.post("/bookings", verifyToken, async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      // Send Email.....
      // if (result.insertedId) {
      //   // To guest
      //   sendEmail(booking.guest.email, {
      //     subject: "Booking Successful!",
      //     message: `Room Ready, chole ashen vai, apnar Transaction Id: ${booking.transactionId}`,
      //   });

      //   // To Host
      //   sendEmail(booking.host, {
      //     subject: "Your room got booked!",
      //     message: `Room theke vago. ${booking.guest.name} ashtese.....`,
      //   });
      // }
      res.send(result);
    });

    // Update room booking status
    app.patch("/rooms/status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          booked: status,
        },
      };
      const result = await roomsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Save or modify user email, status in DB
     app.put("/users/:email", async (req, res) => {
       const email = req.params.email;
       const user = req.body;
       const query = { email: email };
       const options = { upsert: true };
       const isExist = await usersCollection.findOne(query);
       console.log("User found?----->", isExist);
       if (isExist) {
         if (user?.status === "Requested") {
           const result = await usersCollection.updateOne(
             query,
             {
               $set: user,
             },
             options
           );
           return res.send(result);
         } else {
           return res.send(isExist);
         }
       }
       const result = await usersCollection.updateOne(
         query,
         {
           $set: { ...user, timestamp: Date.now() },
         },
         options
       );
       res.send(result);
     });

    //Get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Update user role
    app.put("/users/update/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from StayVista Server..");
});

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`);
});
