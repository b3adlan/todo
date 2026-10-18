const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(process.cwd(), 'data', 'tasks.json');

function normalizeTask(task = {}) {
  return {
    id: String(task.id || (`task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`)),
    title: String(task.title || 'Uppgift').trim(),
    notes: String(task.notes || '').trim(),
    dueDate: task.dueDate || '',
    priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
    category: task.category || 'Övrigt',
    completed: Boolean(task.completed),
    createdAt: task.createdAt || new Date().toISOString()
  };
}

function readJsonFile() {
  try {
    if (!fs.existsSync(DATA_PATH)) return [];
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
  } catch (error) {
    return [];
  }
}

function writeJsonFile(tasks) {
  try {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(tasks, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

async function readSupabaseTasks() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const response = await fetch(`${url}/rest/v1/tasks?select=*`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows.map(normalizeTask) : [];
}

async function writeSupabaseTasks(tasks) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return false;

  const response = await fetch(`${url}/rest/v1/tasks`, {
    method: 'PUT',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(tasks)
  });

  return response.ok;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        resolve({});
      }
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const body = req.method === 'GET' ? {} : await parseBody(req);

    const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    let tasks = useSupabase ? await readSupabaseTasks() : readJsonFile();

    if (req.method === 'GET') {
      if (!tasks) tasks = [];
      return res.status(200).json({ tasks });
    }

    if (req.method === 'POST') {
      const incoming = Array.isArray(body.tasks) ? body.tasks : [body.task || body];
      const nextTasks = incoming.map(normalizeTask);
      const merged = Array.isArray(tasks) ? [...tasks, ...nextTasks] : nextTasks;

      if (useSupabase) {
        await writeSupabaseTasks(merged);
      } else {
        writeJsonFile(merged);
      }

      return res.status(200).json({ tasks: merged });
    }

    if (req.method === 'PUT') {
      if (Array.isArray(body.tasks)) {
        const replaced = body.tasks.map(normalizeTask);
        if (useSupabase) {
          await writeSupabaseTasks(replaced);
        } else {
          writeJsonFile(replaced);
        }
        return res.status(200).json({ tasks: replaced });
      }

      if (body.task) {
        const updated = normalizeTask(body.task);
        const targetIndex = (tasks || []).findIndex((task) => task.id === updated.id);
        const nextTasks = [...(tasks || [])];

        if (targetIndex >= 0) {
          nextTasks[targetIndex] = updated;
        } else {
          nextTasks.push(updated);
        }

        if (useSupabase) {
          await writeSupabaseTasks(nextTasks);
        } else {
          writeJsonFile(nextTasks);
        }

        return res.status(200).json({ tasks: nextTasks });
      }
    }

    if (req.method === 'DELETE') {
      const id = body.id || body.task?.id || req.query?.id;
      const nextTasks = (tasks || []).filter((task) => task.id !== id);

      if (useSupabase) {
        await writeSupabaseTasks(nextTasks);
      } else {
        writeJsonFile(nextTasks);
      }

      return res.status(200).json({ tasks: nextTasks });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};
