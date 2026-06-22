const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });
    const db = client.db('ai-prompt');
    const promptCollection = db.collection('prompts');
    const reportCollection = db.collection('reports');
    const paymentCollection = db.collection('payments');
    // add prompt
    app.post('/api/prompts', async (req, res) => {
      try {
        const prompt = req.body;

        const newPrompt = {
          title: prompt.title,
          description: prompt.description,
          content: prompt.content,
          category: prompt.category,
          aiTool: prompt.aiTool,
          tags: prompt.tags || [],
          difficulty: prompt.difficulty,
          thumbnail: prompt.thumbnail,
          visibility: prompt.visibility,
          userEmail: prompt.userEmail,
          copyCount: 0,
          status: 'pending',
          accessType: 'free',
          createdAt: new Date(),
        };

        const result = await promptCollection.insertOne(newPrompt);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: 'Failed to create prompt',
        });
      }
    });
    // all prompts

    app.get('/api/marketplace-prompts', async (req, res) => {
      try {
        const { aiTool, category, sort } = req.query;

        const query = {
          status: 'approved',
          visibility: 'public',
        };

        if (aiTool) {
          query.aiTool = aiTool;
        }

        if (category) {
          query.category = category;
        }

        let sortOption = {
          createdAt: -1,
        };

        if (sort === 'copied') {
          sortOption = {
            copyCount: -1,
          };
        }

        const prompts = await promptCollection
          .find(query)
          .sort(sortOption)
          .toArray();

        res.send({
          success: true,
          data: prompts,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: 'Failed to fetch prompts',
        });
      }
    });
    // featured prompts
    app.get('/api/prompts/featured', async (req, res) => {
      try {
        console.log('FEATURED ROUTE HIT');

        const result = await promptCollection.find({}).limit(6).toArray();

        console.log(result);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('FEATURED ERROR =>', error);

        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // details
    app.get('/api/prompts/:id', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).json({
            success: false,
            message: 'Prompt not found',
          });
        }

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error(error);

        res.status(500).json({
          success: false,
          message: 'Server Error',
        });
      }
    });
    // copy count
    app.patch('/api/prompts/:id/copy', async (req, res) => {
      try {
        const { id } = req.params;

        await promptCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: {
              copyCount: 1,
            },
          },
        );

        const updatedPrompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          copyCount: updatedPrompt.copyCount,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });
    // rating
    app.patch('/api/prompts/:id/rating', async (req, res) => {
      try {
        const { id } = req.params;
        const { rating } = req.body;

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
          });
        }

        const currentRating = prompt.rating || 0;

        const currentCount = prompt.ratingCount || 0;

        const newAverage =
          (currentRating * currentCount + rating) / (currentCount + 1);

        await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              rating: Number(newAverage.toFixed(1)),
            },
            $inc: {
              ratingCount: 1,
            },
          },
        );

        const updatedPrompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          rating: updatedPrompt.rating,
          ratingCount: updatedPrompt.ratingCount,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });

    // admin all prompts
    app.get('/api/prompts', async (req, res) => {
      const prompts = await promptCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.send({
        success: true,
        data: prompts,
      });
    });
    // admin approve
    app.patch('/api/prompts/:id/approve', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: 'approved',
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // change access type
    app.patch('/api/prompts/:id/access', async (req, res) => {
      try {
        const { id } = req.params;
        const { accessType } = req.body;

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              accessType,
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });
    // admin reject
    app.patch('/api/prompts/:id/reject', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: 'rejected',
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });

    // delete prompt
    app.delete('/api/prompts/:id', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // report create
    app.post('/api/reports', async (req, res) => {
      try {
        const report = req.body;

        report.status = 'pending';
        report.createdAt = new Date();

        const result = await reportCollection.insertOne(report);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // get all reports
    app.get('/api/reports', async (req, res) => {
      try {
        const reports = await reportCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send(reports);
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // admin analytics
    app.get('/api/admin/analytics', async (req, res) => {
      try {
        // Total Prompts
        const totalPrompts = await promptCollection.countDocuments();

        // Total Reviews
        const totalReviews = await reportCollection.countDocuments();

        // Total Copies
        const copiesResult = await promptCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalCopies: {
                  $sum: '$copyCount',
                },
              },
            },
          ])
          .toArray();

        const totalCopies = copiesResult[0]?.totalCopies || 0;

        // Total Revenue
        // const revenueResult =
        //   await paymentCollection
        //     .aggregate([
        //       {
        //         $group: {
        //           _id: null,
        //           totalRevenue: {
        //             $sum: '$amount',
        //           },
        //         },
        //       },
        //     ])
        //     .toArray()

        // const totalRevenue =
        //   revenueResult[0]?.totalRevenue || 0
        const totalRevenue = 0;

        res.send({
          success: true,
          data: {
            totalPrompts,
            totalReviews,
            totalCopies,
            totalRevenue,
          },
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: 'Failed to load analytics',
        });
      }
    });
    // user my prompts
    app.get('/api/prompts/user/:email', async (req, res) => {
      const result = await promptCollection
        .find({ userEmail: req.params.email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send({
        success: true,
        data: result,
      });
    });
    // marketplace prompts approve
    app.get('/api/marketplace-prompts', async (req, res) => {
      const result = await promptCollection
        .find({
          status: 'approved',
          visibility: 'public',
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.send({
        success: true,
        data: result,
      });
    });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!',
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
