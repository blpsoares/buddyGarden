import { describe, it, expect, afterEach } from 'bun:test';
import {
  createConversation,
  listConversations,
  getConversationMeta,
  getConversation,
  appendMessages,
  deleteConversation,
  deleteConversations,
  renameConversation,
  getConversationProjectDirs,
  type ConversationMeta,
  type ConversationMessage,
} from '../server/conversations.ts';

// IDs criados nos testes — limpamos no afterEach
const created: string[] = [];

afterEach(() => {
  for (const id of created.splice(0)) {
    try { deleteConversation(id); } catch { /* já deletado */ }
  }
});

// Cria conversa de teste e registra para limpeza automática
function makeConv(msg = 'Mensagem de teste', dirs?: string[]): ConversationMeta {
  const meta = createConversation(msg, dirs);
  created.push(meta.id);
  return meta;
}

// ── createConversation ──────────────────────────────────────────────────────────

describe('createConversation', () => {
  it('cria conversa e retorna meta com id', () => {
    const meta = makeConv('Olá buddy!');
    expect(meta.id).toBeTruthy();
    expect(typeof meta.id).toBe('string');
  });

  it('título truncado a 60 chars com reticências', () => {
    const longa = 'a'.repeat(80);
    const meta = makeConv(longa);
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.title.endsWith('...')).toBe(true);
  });

  it('título curto não é truncado', () => {
    const meta = makeConv('Mensagem curta');
    expect(meta.title).toBe('Mensagem curta');
  });

  it('messageCount começa em 0', () => {
    const meta = makeConv('Init');
    expect(meta.messageCount).toBe(0);
  });

  it('createdAt e updatedAt são timestamps numéricos', () => {
    const before = Date.now();
    const meta = makeConv('Timestamp test');
    const after = Date.now();
    expect(meta.createdAt).toBeGreaterThanOrEqual(before);
    expect(meta.createdAt).toBeLessThanOrEqual(after);
    expect(meta.updatedAt).toBe(meta.createdAt);
  });

  it('dois creates geram ids únicos', () => {
    const a = makeConv('A');
    const b = makeConv('B');
    expect(a.id).not.toBe(b.id);
  });
});

// ── listConversations ───────────────────────────────────────────────────────────

describe('listConversations', () => {
  it('retorna lista (pode conter outras do usuário)', () => {
    const result = listConversations();
    expect(Array.isArray(result)).toBe(true);
  });

  it('conversa criada aparece na lista', () => {
    const meta = makeConv('Lista test');
    const list = listConversations();
    const found = list.find(m => m.id === meta.id);
    expect(found).toBeDefined();
  });

  it('lista ordenada por updatedAt decrescente', () => {
    const a = makeConv('Primeira');
    // Pequena pausa para garantir timestamps distintos
    Bun.sleepSync(5);
    const b = makeConv('Segunda');
    const list = listConversations();
    const idxA = list.findIndex(m => m.id === a.id);
    const idxB = list.findIndex(m => m.id === b.id);
    // b foi criada depois → deve aparecer antes (índice menor)
    expect(idxB).toBeLessThan(idxA);
  });
});

// ── getConversationMeta ─────────────────────────────────────────────────────────

describe('getConversationMeta', () => {
  it('retorna meta para id existente', () => {
    const meta = makeConv('Meta test');
    const found = getConversationMeta(meta.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(meta.id);
  });

  it('retorna null para id inexistente', () => {
    expect(getConversationMeta('id-que-nao-existe-xyzabc')).toBeNull();
  });
});

// ── getConversation ─────────────────────────────────────────────────────────────

describe('getConversation', () => {
  it('conversa nova está vazia', () => {
    const meta = makeConv('Vazia');
    expect(getConversation(meta.id)).toEqual([]);
  });

  it('retorna array vazio para id inexistente', () => {
    expect(getConversation('id-nao-existe-abc123')).toEqual([]);
  });
});

// ── appendMessages ──────────────────────────────────────────────────────────────

describe('appendMessages', () => {
  it('mensagens adicionadas aparecem ao ler', () => {
    const meta = makeConv('Append test');
    const msgs: ConversationMessage[] = [
      { role: 'user', content: 'Oi!', ts: Date.now() },
      { role: 'assistant', content: 'Olá!', ts: Date.now() },
    ];
    appendMessages(meta.id, msgs);
    const result = getConversation(meta.id);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Oi!');
    expect(result[1].content).toBe('Olá!');
  });

  it('messageCount atualizado no índice', () => {
    const meta = makeConv('Count test');
    appendMessages(meta.id, [
      { role: 'user', content: 'msg1', ts: Date.now() },
    ]);
    const updated = getConversationMeta(meta.id);
    expect(updated!.messageCount).toBe(1);
  });

  it('append múltiplas vezes acumula mensagens', () => {
    const meta = makeConv('Acumula');
    appendMessages(meta.id, [{ role: 'user', content: 'a', ts: Date.now() }]);
    appendMessages(meta.id, [{ role: 'assistant', content: 'b', ts: Date.now() }]);
    appendMessages(meta.id, [{ role: 'user', content: 'c', ts: Date.now() }]);
    expect(getConversation(meta.id)).toHaveLength(3);
    expect(getConversationMeta(meta.id)!.messageCount).toBe(3);
  });

  it('não quebra se o id não existe', () => {
    expect(() =>
      appendMessages('id-nao-existe', [{ role: 'user', content: 'x', ts: 0 }])
    ).not.toThrow();
  });
});

// ── deleteConversation ──────────────────────────────────────────────────────────

describe('deleteConversation', () => {
  it('conversa deletada não aparece na lista', () => {
    const meta = createConversation('Para deletar');
    deleteConversation(meta.id);
    expect(listConversations().find(m => m.id === meta.id)).toBeUndefined();
  });

  it('getConversationMeta retorna null após deletar', () => {
    const meta = createConversation('Delete meta');
    deleteConversation(meta.id);
    expect(getConversationMeta(meta.id)).toBeNull();
  });

  it('não quebra ao deletar id inexistente', () => {
    expect(() => deleteConversation('nao-existe-xyz')).not.toThrow();
  });
});

// ── deleteConversations ─────────────────────────────────────────────────────────

describe('deleteConversations', () => {
  it('deleta múltiplas de uma vez', () => {
    const a = createConversation('Del multi A');
    const b = createConversation('Del multi B');
    deleteConversations([a.id, b.id]);
    const list = listConversations();
    expect(list.find(m => m.id === a.id)).toBeUndefined();
    expect(list.find(m => m.id === b.id)).toBeUndefined();
  });

  it('array vazio não quebra', () => {
    expect(() => deleteConversations([])).not.toThrow();
  });
});

// ── renameConversation ──────────────────────────────────────────────────────────

describe('renameConversation', () => {
  it('atualiza título no índice', () => {
    const meta = makeConv('Título original');
    renameConversation(meta.id, 'Novo título');
    const updated = getConversationMeta(meta.id);
    expect(updated!.title).toBe('Novo título');
  });

  it('não quebra ao renomear id inexistente', () => {
    expect(() => renameConversation('nao-existe', 'titulo')).not.toThrow();
  });
});

// ── getConversationProjectDirs ──────────────────────────────────────────────────

describe('getConversationProjectDirs', () => {
  it('retorna [] para meta null', () => {
    expect(getConversationProjectDirs(null)).toEqual([]);
  });

  it('retorna projectDirs quando presente', () => {
    const meta: ConversationMeta = {
      id: 'x', title: 'x', createdAt: 0, updatedAt: 0, messageCount: 0,
      projectDirs: ['/tmp', '/home'],
    };
    expect(getConversationProjectDirs(meta)).toEqual(['/tmp', '/home']);
  });

  it('migra campo legado projectDir para array', () => {
    const meta: ConversationMeta = {
      id: 'x', title: 'x', createdAt: 0, updatedAt: 0, messageCount: 0,
      projectDir: '/tmp/legado',
    };
    expect(getConversationProjectDirs(meta)).toEqual(['/tmp/legado']);
  });

  it('projectDirs tem precedência sobre projectDir', () => {
    const meta: ConversationMeta = {
      id: 'x', title: 'x', createdAt: 0, updatedAt: 0, messageCount: 0,
      projectDirs: ['/novo'],
      projectDir: '/legado',
    };
    expect(getConversationProjectDirs(meta)).toEqual(['/novo']);
  });

  it('retorna [] se nenhum dir configurado', () => {
    const meta: ConversationMeta = {
      id: 'x', title: 'x', createdAt: 0, updatedAt: 0, messageCount: 0,
    };
    expect(getConversationProjectDirs(meta)).toEqual([]);
  });
});
