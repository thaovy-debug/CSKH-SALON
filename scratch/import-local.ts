import { prisma } from '../src/lib/prisma';
import { importKnowledgeDocument } from '../src/lib/knowledge/import';
import { indexKnowledgeEntry } from '../src/lib/ai/semantic-search';
import fs from 'fs';
import path from 'path';

async function run() {
  const dir = path.join(process.cwd(), 'data', 'knowledge');
  const files = fs.readdirSync(dir);
  
  let category = await prisma.category.findFirst({ where: { name: 'Main Category' } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Main Category', description: 'Main category for imported knowledge', icon: 'folder', color: '#4A7C9B' }
    });
  }

  const settings = await prisma.settings.findFirst({ select: { aiApiKey: true } });
  for (const file of files) {
    if (!file.endsWith('.docx')) continue;
    
    console.log('Importing', file);
    const buffer = fs.readFileSync(path.join(dir, file));
    const imported = await importKnowledgeDocument(file, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer);
    for (let i = 0; i < imported.sections.length; i++) {
        const section = imported.sections[i];
        const entry = await prisma.knowledgeEntry.create({
            data: {
                categoryId: category.id,
                title: section.title,
                content: section.content,
                priority: 50,
                metadata: { ...section.metadata, importedFrom: file, importedAt: new Date().toISOString() }
            }
        });
        
        if (settings?.aiApiKey) {
            await indexKnowledgeEntry(entry.id, settings.aiApiKey);
        }
    }
  }
  console.log('Import done');
}

run().catch(console.error);
