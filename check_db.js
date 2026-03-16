import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '/home/ruddy/Documents/projetMusculationAppli/.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    const { data, error } = await supabase
        .from('performances')
        .select('*')
        .ilike('exercise_name', '%ouch%')
        .order('performance_date', { ascending: false })

    if (error) {
        console.error('Error fetching performances:', error)
        return
    }

    console.log(`Found ${data.length} performances for Développé Couché.`)
    console.log('Latest 15:')
    console.log(JSON.stringify(data.slice(0, 15), null, 2))
}

run()
