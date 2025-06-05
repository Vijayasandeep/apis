import express, { json } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔧 Basic middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 📝 Logging middleware
// app.use((req, res, next) => {
//     const timestamp = new Date().toISOString();
//     console.log(`📡 [${timestamp}] ${req.method} ${req.url}`);
//     if (Object.keys(req.body).length > 0) {
//         console.log('Body:', JSON.stringify(req.body, null, 2));
//     }
//     next();
// });

// 🔄 Data mapping configuration based on objectCmd
const COMMAND_MAPPING = {
    '0': { name: 'cancel', value: 1 },
    '2': { name: 'bill', value: 1 },
    '3': { name: 'call', value: 1 },  // call for waiter
    '4': { name: 'drinks', value: 1 }
};

// 🔍 Helper function to map device data
function mapDeviceData(rawData) {
    try {
        const deviceId = parseInt(rawData.objectId);
        const commandCode = rawData.objectCmd;

        if (!deviceId || commandCode === undefined) {
            throw new Error('Missing required fields: objectId or objectCmd');
        }

        // Initialize mapped data with all fields set to 0
        const mappedData = {
            deviceid: deviceId,
            cancel: 0,
            bill: 0,
            call: 0,
            drinks: 0
        };

        // Set the appropriate field based on objectCmd
        const command = COMMAND_MAPPING[commandCode];
        if (command) {
            mappedData[command.name] = command.value;
        } else {
            console.warn(`⚠️ Unknown command code: ${commandCode}`);
            // For unknown commands, default to call
            mappedData.call = 1;
        }

        return mappedData;
    } catch (error) {
        console.error('❌ Error mapping device data:', error);
        throw error;
    }
}

async function sendSqsMessage(jsonData) {
    const name = jsonData.commandInfo.tenantCode + '-' + jsonData.commandInfo.branchCode;
    const data = {
        "type": "SewaCall",
        "data": jsonData,
        "queueName": name
    }
    axios.post('https://0r63ieqh2f.execute-api.us-east-1.amazonaws.com/Prod/initiateQueue', data)
        .then(response => {
            console.log('✅ SQS message sent successfully:', response.data);
        })
}
// 🏠 Health check endpoint
// app.get('/', (req, res) => {
//     console.log('✔️ Health check request received');
//     res.json({
//         status: 'healthy',
//         timestamp: new Date().toISOString(),
//         version: '1.0.0',
//         service: 'IoT Device Data Mapper',
//         endpoints: {
//             health: 'GET /',
//             receiveData: 'POST /getall'
//         },
//         commandMapping: {
//             '0': 'cancel',
//             '2': 'bill',
//             '3': 'call (waiter)',
//             '4': 'drinks'
//         }
//     });
// });

// 📥 Main endpoint to receive device data
app.post('/getall', async (req, res) => {
    try {
        const rawData = req.body;
        console.log('📥 Raw data received on /getall:', JSON.stringify(rawData, null, 2));

        // Validate input
        if (!rawData || typeof rawData !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid data format. Expected JSON object.',
                timestamp: new Date().toISOString()
            });
        }

        // Validate required fields
        if (!rawData.objectId || rawData.objectCmd === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: objectId and objectCmd are required',
                timestamp: new Date().toISOString()
            });
        }

        // Map the data
        const mappedData = mapDeviceData(rawData);
        console.log('🔄 Mapped data:', JSON.stringify(mappedData, null, 2));
        // Store in memory with timestamp
        // const deviceRecord = {
        //   ...mappedData,
        //   originalData: rawData,
        //   lastUpdated: new Date().toISOString()
        // };
        // const existingIndex = deviceDataStore.findIndex(d => d.deviceid === mappedData.deviceid);
        // if (existingIndex !== -1) {
        //   deviceDataStore[existingIndex] = deviceRecord;
        // } else {
        //   deviceDataStore.push(deviceRecord);
        // }
        // Return success response with mapped data
        const jsonData = {
            success: true,
            message: 'Data received and mapped successfully',
            commandInfo: {
                received: rawData.objectCmd,
                tenantCode: rawData.tenantCode || 'unknown',
                branchCode: rawData.branchCode || 'unknown',
                channel: rawData.channel || 'unknown',
                mapped: COMMAND_MAPPING[rawData.objectCmd]?.name || 'unknown',
                description: getCommandDescription(rawData.objectCmd)
            },
            timestamp: new Date().toISOString()
        }
        sendSqsMessage(jsonData)
        console.log(jsonData)
        res.json({
            success: true,
            message: 'Data received and mapped successfully',
            //   data: mappedData,
            commandInfo: {
                received: rawData.objectCmd,
                tenantCode: rawData.tenantCode || 'unknown',
                branchCode: rawData.branchCode || 'unknown',
                channel: rawData.channel || 'unknown',
                mapped: COMMAND_MAPPING[rawData.objectCmd]?.name || 'unknown',
                description: getCommandDescription(rawData.objectCmd)
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error processing /getall request:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Helper function to get command description
function getCommandDescription(commandCode) {
    const descriptions = {
        '0': 'Cancel current request',
        '2': 'Request bill/payment',
        '3': 'Call waiter for assistance',
        '4': 'Order drinks'
    };
    return descriptions[commandCode] || 'Unknown command';
}

// Helper function to get device status
// function getDeviceStatus(device) {
//   if (device.cancel === 1) return 'cancelled';
//   if (device.bill === 1) return 'requesting_bill';
//   if (device.call === 1) return 'calling_waiter';
//   if (device.drinks === 1) return 'ordering_drinks';
//   return 'idle';
// }

// ❌ Catch-all for unmatched routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: [
            'GET /',
            'POST /getall',
            'GET /devices',
            'GET /devices/:id',
            'GET /devices/summary',
            'DELETE /devices/clear'
        ],
        timestamp: new Date().toISOString()
    });
});

// 🚨 Global error handler
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// 🚀 Start server
app.listen(PORT, '0.0.0.0', () => {
});