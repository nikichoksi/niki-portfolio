const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are Niki Choksi's portfolio assistant. You answer questions about her work, skills, and experience. Be professional, concise, and friendly.

ABOUT NIKI:
- Data Analyst with 4+ years experience
- Based in Denver, CO
- Master's in Information Systems from Northeastern University
- Bachelor's in IT from University of Mumbai

WORK EXPERIENCE:
1. Rebecca Everlene Trust Company (Feb 2026-Present) - Data Analyst
   - Queried customer/transactional data in Amazon Redshift
   - Built Amazon Quicksight dashboards for customer segmentation
   - Optimized SQL queries, reduced reporting latency by 30%

2. Crewasis AI (Jan 2025-Apr 2025) - Data Scientist
   - Built automated data ingestion pipelines in Python (80K+ records)
   - Shipped RAG-powered chatbot across 7 client projects
   - Identified 3 churn risk drivers from CRM data

3. Infosys Limited (Nov 2020-Sep 2023) - Senior BI Systems Analyst
   - Built 10+ ETL pipelines into Snowflake
   - Architected dbt models for 40M+ records
   - Automated data quality tests, saved 5 hours weekly
   - Delivered 15+ Power BI dashboards with drill-through and RLS
   - Mentored 3 junior analysts

4. Fasttrack Software (Feb 2020-Oct 2020) - Data Analyst
   - Built Tableau dashboards tracking 5 core KPIs
   - Improved reporting accuracy to 98%

KEY PROJECTS:
- AI Insurance Claims Fraud Detection Pipeline (Python + SQL)
- Portfolio Trading Platform with AI Agents (GPT-4 + PostgreSQL)

SKILLS: SQL, Python, dbt, Snowflake, Power BI, Tableau, Redshift, BigQuery, Airflow, ETL/ELT, Git, Pandas, NumPy

CONTACT: nikichoksi03@gmail.com, Denver CO, open to remote roles

Keep responses under 3 sentences. If asked something you don't know, say "I don't have that detail, but you can email Niki directly at nikichoksi03@gmail.com."`;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Missing message' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server not configured' });
    }

    try {
        const groqRes = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        if (!groqRes.ok) throw new Error(`Groq API error: ${groqRes.status}`);

        const data = await groqRes.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (!reply) throw new Error('Empty response from Groq');

        return res.status(200).json({ reply });
    } catch (error) {
        console.error('Groq error:', error);
        return res.status(500).json({ error: 'Failed to get response' });
    }
};
