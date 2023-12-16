/// <reference path="../global.d.ts" />

import express, { Application, NextFunction, Request, Response } from "express"
import connectToMongoDB from "./database/connection"
import questionByCategoryRoutes from "./routes/questionsByCategoryRoutes"
import categoryOrderRoutes from "./routes/createOrderRoutes"
import userRoutes from "./routes/userRoutes"
import cors from "cors"

const app: Application = express()
const PORT = process.env.PORT || 3001
//connect to mongodb
connectToMongoDB()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())

//app.use request
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toString()} => ${req.method} ${req.originalUrl}`)
    next()
})

app.get('/', (req: Request, res: Response) => {
    res.send("Working Fine!!")
})

// api routes
app.use('/questionsByCategory', questionByCategoryRoutes)
app.use('/categoryOrder', categoryOrderRoutes)
app.use('/user', userRoutes)

app.listen(PORT, () => {
    console.log(`App Listening at PORT=${PORT} and BASEURL=http://localhost:${PORT}`)
})
