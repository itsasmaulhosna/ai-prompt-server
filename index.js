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
    //add prompt
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
    // my prompt
    app.get('/api/prompts', async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send(prompts);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: 'Failed to fetch prompts',
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
