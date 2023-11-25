const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require("jsonwebtoken")
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000

//middleware 
app.use(cors())
app.use(express.json())




const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9q6ocyc.mongodb.net/?retryWrites=true&w=majority`;

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
        //jwt related api 
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.SECRET_TOKEN, {
                expiresIn: "10h"
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
        //post users 
        app.post("/users", async (req, res) => {
            const user = req.body
            //insert email if user does not exist
            //you can do this many ways ((1.eamil unique, 2.upsert, 3.simple way) 

            const query = { email: user.email }
            const existingUser = await usersAllCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "user already exists", insertedId: null })
            }
            const result = await usersAllCollection.insertOne(user)
            res.send(result)
        })

        // Get user role
        app.get('/allBioData/', async (req, res) => {
            const result = await editBioDataAllCollection.find().toArray()
            res.send(result)
        })

        // Get single user role
        app.get('/allBioData/:email', async (req, res) => {
            const email = req.params.email
            const query = { userEmail: email }
            const result = await editBioDataAllCollection.findOne( query )
            res.send(result)
        })

         //user send request to premium
         app.post('/premiumRequest', async (req, res) => {
            const request = req.body
            const result = await requestCollection.insertOne(request)
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
                console.log(result);
                res.send(result)
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