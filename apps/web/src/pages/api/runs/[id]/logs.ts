import { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid run ID' });
  }

  try {
    // Find the log file in the project root
    const cwd = process.cwd();
    const normalizedCwd = cwd.replace(/\\/g, '/');
    const projectRoot = (normalizedCwd.includes('apps') && normalizedCwd.includes('web'))
      ? path.resolve(cwd, '..', '..')
      : cwd;
    
    const logFilePath = path.join(projectRoot, `analysis-run-${id}.log`);
    
    // Check if log file exists
    if (!fs.existsSync(logFilePath)) {
      return res.status(200).json({ 
        logs: '',
        exists: false,
        message: 'Log file not found yet. Analysis may not have started.'
      });
    }

    // Read the log file
    const logs = fs.readFileSync(logFilePath, 'utf-8');
    
    return res.status(200).json({ 
      logs,
      exists: true,
      lastModified: fs.statSync(logFilePath).mtime.toISOString()
    });
  } catch (error: any) {
    console.error('Error reading log file:', error);
    return res.status(500).json({ 
      error: error.message,
      logs: ''
    });
  }
}

