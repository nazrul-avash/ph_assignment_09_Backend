const express = require("express");
const dontenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dontenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors({
    origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
 
  try {
    const { payload } = await jwtVerify(token, JWKS,{
      algorithms: ["EdDSA"],                    // Tell it to expect EdDSA asymmetric keys
      issuer: process.env.CLIENT_URL,          // Matches the token's "iss" (e.g., http://localhost:3000)
      audience: process.env.CLIENT_URL,
      clockTolerance: "5 minutes"
    });
    console.log(payload);
    next();
  } catch (error) {
    console.log(error.message);
    return res.status(403).json({ message: "Forbidden" });
  }
};
async function run() {
  try {
  

    const db = client.db("DocApp");
    const doctorCollection = db.collection("doctors");
   const bookingCollection = db.collection("booking");
   const userCollection = db.collection("user");

    app.get("/doctors", async (req, res) => {
      const result = await doctorCollection.find().toArray()
      res.json(result)   
    })
    app.get("/doctors/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const result = await doctorCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });
      app.post("/booking", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingCollection.insertOne(bookingData);
      res.json(result);
    });
app.get("/appointments", async (req, res) => {
  const result = await bookingCollection
    .aggregate([
      {
        $lookup: {
          from: "doctors",
          localField: "doctorId",
          foreignField: "id",
          as: "doctor",
        },
      },

      {
        $unwind: "$doctor",
      },

      {
        $project: {
          _id: 1,
          userId: 1,
          userEmail: 1,
          doctorId: 1,
          doctorName: 1,
          patientName: 1,
          gender: 1,
          phone: 1,
          appointmentDate: 1,
          appointmentTime: 1,

          doctorImage: "$doctor.image",
          doctorMongoId: "$doctor._id",
        },
      },
    ])
    .toArray();

  res.send(result);
});

  app.get("/booking/:userId", async (req, res) => {
      const { userId } = req.params;

      const result = await bookingCollection.find({ userId: userId }).toArray();

      res.json(result);
    });
  
  app.patch("/booking/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      console.log(updatedData);

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );

      res.json(result);
    });



      app.delete("/booking/:bookingId", verifyToken, async (req, res) => {
      const { bookingId } = req.params;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(bookingId),
      });

      res.json(result);
    });

    app.patch("/profile/:email", async (req, res) => {
      const { email } = req.params;
      const updatedData = req.body;
      
      console.log(updatedData);
      const result = await userCollection.updateOne(
        { email: email },
        { $set: updatedData },
      );
      console.log(result);
      res.json(result);
    
    });

  app.get("/profile/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);

    const user = await userCollection.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("GET /profile error:", error);

    res.status(500).json({
      message: "Failed to fetch user",
    });
  }
});


    app.post("/booking", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingCollection.insertOne(bookingData);

      res.json(result);
    });

  

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is Working!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});