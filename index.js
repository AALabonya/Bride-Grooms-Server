const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const stripe = require('stripe')(process.env.SECRET_KEYS_API_SK)
const jwt = require("jsonwebtoken")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000

//middleware 
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9q6ocyc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        //create collection
        const editBioDataAllCollection = client.db("matrimonyDB").collection("allBioData")
        const usersAllCollection = client.db("matrimonyDB").collection("users")
        const requestCollection = client.db("matrimonyDB").collection("request")
        const favoritesBiodataCollection = client.db("matrimonyDB").collection("favorites")
        const paymentCollection = client.db("matrimonyDB").collection("payment")
        const successStoryReview = client.db("matrimonyDB").collection("successStory")

        //jwt related api 
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.SECRET_TOKEN, {
                expiresIn: "160h"
            })
            res.send({ token })
        })

        //middleWare 
        const verifyToken = (req, res, next) => {
            console.log("inside verify token", req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unAuthorized access" })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "unAuthorized access" })
                }
                req.decoded = decoded;
                next()
            })
        }
        //admin verify middleware (use verify admin after verifyToken)
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await usersAllCollection.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next()
        }
        //users related api
        app.get("/users", async (req, res) => {

            const result = await usersAllCollection.find().toArray()
            res.send(result)
        })
        //post users 
        app.post("/users", async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existingUser = await usersAllCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "user already exists", insertedId: null })
            }
            const result = await usersAllCollection.insertOne(user)
            res.send(result)
        })

        //get admin 
        app.get('/users/admin/:email', async (req, res) => {
            //request.params ar moddhe theke email take nilam
            const email = req.params.email
            const query = { email: email };
            const user = await usersAllCollection.findOne(query)
            let admin = false
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })
        //admin api 
        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await usersAllCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // //approved user premium
        app.patch('/managesUserPremium/:email', async (req, res) => {
            const email = req.params.email
            console.log(email);

            const updateData = {
                $set: {
                    accountType: "premium",
                }
            }
            const updateResult = await usersAllCollection.updateOne({ email: email }, updateData)
            const result = await editBioDataAllCollection.updateOne({ userEmail: email }, updateData)
            console.log(result);
            res.send(updateResult)
        })

        // Get filter data
        app.get('/allBioData', async (req, res) => {
            const search = req.query.search
            const filter = req.query;
            const gender = req.query.gender
         
            const page = parseInt(req.query.page)
             let minAge=parseInt(req.query.minAge)
             let maxAge=parseInt(req.query.maxAge)
            let queryObj={}
            //filter
            if(minAge && maxAge){
                queryObj={
                    age:{ $gte: minAge, $lte: maxAge }
                }
            }
            if (search) {
                queryObj = {
                    permanentDivision: {
                        $regex: search,
                        $options: "i"
                    }
                }
            }

            if (gender) {
                queryObj = {
                    biodataType: {
                        $regex: gender,

                    }
                }
            }

          
            const cursor = editBioDataAllCollection.find(queryObj).skip(page * 6).limit(6)

            const result = await cursor.toArray()
            res.send(result)
        })
         app.get("/bioDataAll", async (req, res)=>{
            const result = await editBioDataAllCollection.find().toArray()
            res.send(result)
         })

        //get premium
        app.get("/allBioDataPremium", async (req, res) => {

            const result = await editBioDataAllCollection.find({accountType:"premium"}).sort( { age: -1 }).toArray()
            res.send(result)
        })

        //get pagination 
        app.get("/allBioDataCount", async (req, res) => {

            const count = await editBioDataAllCollection.estimatedDocumentCount()
            res.send({ count })
        })

        // Get single user role
        app.get('/allBioData/:email', async (req, res) => {
            const email = req.params.email
            const query = { userEmail: email }
            const result = await editBioDataAllCollection.findOne(query)
            res.send(result)
        })

        app.patch('/update-biodata', async (req, res) => {
            try {
                const email = req.query.email
               
                const updateBiodata = req.body;
                const query = { userEmail: email };
               
                const available = await editBioDataAllCollection.findOne()
                delete updateBiodata._id;
                delete available._id;
                const update = {
                    ...available,
                    ...updateBiodata
                }
          
                const result = await editBioDataAllCollection.updateOne(query, { $set: update });
                res.send(result);
              
            } catch (error) {
                console.log(error)
            }
        })


        //user send request to premium
        app.post('/premiumRequest', async (req, res) => {
            const requestData = req.body
            const query = { userEmail: requestData.userEmail }
            const updateData = {
                $set: {
                    premiumRequestStatus: "pending",
                }
            }
            const updateStatus = await editBioDataAllCollection.updateOne(query, updateData)
            const result = await requestCollection.insertOne(requestData)
            res.send(result)
        })

        //get manage users
        app.get("/manageUsers", async (req, res) => {
            const filter =req.query
            const query ={
                name:{$regex:filter.search, $options:"i"}
            }
          
            const result = await usersAllCollection.find(query).toArray()
           
            res.send(result)
        })
        //get request 
        app.get("/premiumRequest", async (req, res) => {
            const result = await requestCollection.find().toArray()
            res.send(result)
        })
        //post allBioData
        app.post("/allBioData", async (req, res) => {
            try {
                const bioData = req.body
                const email = req.query.email
                const query = { userEmail: email }
                const exist = await editBioDataAllCollection.findOne(query)
                if (exist) {
                    return res.send({ message: "user already exists", insertedId: null })
                }
                const count = await editBioDataAllCollection.estimatedDocumentCount();
                const result = await editBioDataAllCollection.insertOne({
                    biodataId: count + 1, ...bioData
                })
                res.send(result)
            } catch (err) {
                console.log(err);

            }
        })
       
       
        //approve premium 
        app.patch("/approvePremium", async (req, res) => {
            try {
                const id = parseInt(req.query.id)
               
                const query = { biodataId: id }
            
                console.log(query);
                const updateDoc = {
                    $set: {
                        premiumRequestStatus: "approved",
                        accountType:"premium"
                    },
                }
                const updateResult = await editBioDataAllCollection.updateOne(query, updateDoc)
                const updateResult2 = {
                    $set: {
                        premiumRequestStatus: "approved",
                    }
                }
                const result = await requestCollection.updateOne(query, updateResult2)
                console.log(result);
                res.send(result)
            } catch (err) {
                console.log(err);
            }
        })
        //all statistics 
        app.get("/statistics", async (req, res) => {
            try {
                const userInfo = await editBioDataAllCollection.estimatedDocumentCount();
                const userMale = await editBioDataAllCollection.countDocuments({ biodataType: 'Male' })
                const userFemale = await editBioDataAllCollection.countDocuments({ biodataType: 'Female' })
                const premiumMember = await requestCollection.estimatedDocumentCount();
                const result = await paymentCollection.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalRevenue: {
                                $sum: '$price'
                            }
                        }
                    }
                ]).toArray()
                revenue = result.length > 0 ? result[0].totalRevenue : 0;
                res.send({ userInfo, userMale, userFemale, premiumMember, revenue })
            } catch (err) {
                console.log(err);
            }
        })

        //using aggregate pipeline 
        app.get("/statistic-result", async (req, res) => {
            const result = await paymentCollection.aggregate([
                {
                    $unwind: "$requesterId"

                },
                {
                    $lookup: {
                        from: "allBioData",
                        localField: "biodataType",
                        foreignField: "neededId",
                        as: "requestId"
                    }
                },
                {
                    $unwind: "$requestId"
                },
                {
                    $group: {
                        _id: "$requestId.biodataType",
                        account: { $first: "$requestId.accountType" },
                        quantity: { $sum: 1 },
                        totalRevenue: { $sum: "$price" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: "$_id",
                        quantity: "$quantity",
                        account: "$account",
                        totalRevenue: "$totalRevenue"
                    }
                }
            ]).toArray()

            res.send(result)
        })



        //add to favorite
        app.post("/addToFavorite", async (req, res) => {
            try {
                const favoriteInfo = req.body
                console.log(favoriteInfo);
                const exist = await favoritesBiodataCollection.findOne({ biodataId: favoriteInfo.biodataId })
                if (exist) {
                    return res.send({ message: "biodataId already exists" })
                }
                const result = await favoritesBiodataCollection.insertOne(favoriteInfo)
                res.send(result)
            } catch (err) {
                console.log(err);
            }
        })

        //get addToFavorite 
        app.get("/favorite", async (req, res) => {
            const result = await favoritesBiodataCollection.find().toArray()
            res.send(result)
        })

        //user Delete 
        app.delete("/favData/:id", async (req, res) => {
            const id = req.params.id
            console.log(id);
            const query = { _id: new ObjectId(id) }
            console.log(query);
            const result = await favoritesBiodataCollection.deleteOne(query)
            console.log(result);
            res.send(result)
        })
        //generate client secret for stripe payment 
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price * 100)
            if (!price || amount < 1) return
            const { client_secret } = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']

            })
            res.send({ clientSecret: client_secret })
        })

        //payment
        app.post('/payments', async (req, res) => {
            const payment = req.body
            const paymentResult = await paymentCollection.insertOne(payment)

            res.send(paymentResult)
        })
        //get all
        app.get("/payment", async (req, res) => {
            const result = await paymentCollection.find().toArray()
            res.send(result)
        })
        //get payment data api 
        app.get("/payment/:email", async (req, res) => {

            const requestEmail = { requestEmail: req.params.email }
            console.log(requestEmail);

            const result = await paymentCollection.find(requestEmail).toArray()
            res.send(result)
        })
        app.delete("/payment/:id", async (req, res) => {
            const id = req.params.id
            console.log(id);
            const query = { _id: new ObjectId(id) }
            console.log(query);
            const result = await paymentCollection.deleteOne(query)
            console.log(result);
            res.send(result)
        })
        //payment patch 
        app.patch("/payment/:id", async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: "approved"
                }
            }
            const result = await paymentCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        //
        //successStory
        app.post('/success', async (req, res) => {
            const successStory = req.body
   
            const storyReview = await successStoryReview.insertOne(successStory)
       
            res.send(storyReview)
        })
        // get success story 
        app.get("/successStory", async (req, res) => {
            try {
                const successStories = await successStoryReview.find({}).sort({ date: -1 }).toArray()
                res.send(successStories);
            } catch (err) {

                res.status(500).json({ message: err.message });
            }
        })
        app.get("/reviewsStory", async (req, res) => {
            try {
                const successStories = await successStoryReview.find().toArray()
                res.send(successStories);
            } catch (err) {

                console.log(err);
            }
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bride and grooms(matrimony) coming soon.....')
})

app.listen(port, () => {
    console.log(`Bride and grooms(matrimony) is running on port ${port}`)
})