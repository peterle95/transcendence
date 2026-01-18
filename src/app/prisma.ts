import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({ adapter })

async function main() {

    console.log("Prisma running...");

   /*  const missingData = await prisma.user.findMany({
        data: {
            id: 1,
            name: "test",
            age: 77 // data must be exactly match the exisitng mandatory schema fields
        }
    }) */

    /* const user = await prisma.user.create({
        data: {
            id:123,
            age: 27,
            email: "peter@test.com",
            name: "Peter",
            data: { hello: "world" },
            role: "BASIC",
            largeNumber: BigInt(123456789),
        }
    }) */
    
    const users = await prisma.user.createMany({
        data: [{
            id:125,
            age: 27,
            email: "test@test.com",
            name: "Test",
            data: { hello: "world" },
            role: "BASIC",
            largeNumber: BigInt(123456789),
        },
        {
            id:124,
            age: 28,
            email: "peter2@test.com",
            name: "Peter2",
            data: { hello: "world" },
            role: "BASIC",
            largeNumber: BigInt(123456789),
        }]
    })
    

    const game = await prisma.game.create({
        data: {
            gameId: 2,
            playerId:123
        }
    })

    /* // create or if present update an user
    const user = await prisma.user.upsert({}) 
    
    // find all users
    const users = await prisma.user.findMany()
    */

    /* const user = await prisma.user.update({
        where: {
            id: 1,
            email: "peter@test.com"
        },
        data: {
            email: "peter2@test.com"
        },
    })

    /* const user = await prisma.user.delete({
        where: {
            id: 1
        }
    }) */
    console.log(users);
    console.log(game);
}

main()