import fs from 'fs'

const envFile = fs.readFileSync('/home/ruddy/Documents/projetMusculationAppli/.env.local', 'utf-8')
const env = Object.fromEntries(
    envFile.split('\n')
        .filter(line => line.includes('='))
        .map(line => line.split('=').map(part => part.trim()))
)

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

async function run() {
    const res = await fetch(`${url}/rest/v1/performances?exercise_name=ilike.*ouch*&order=performance_date.desc`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        }
    })

    const data = await res.json()
    console.log(`Found ${data.length} performances for Développé Couché.`)
    console.log('Latest 15:')
    console.log(JSON.stringify(data.slice(0, 15), null, 2))
}

run().catch(console.error)
