# Tarefas em equipe — publicação na Vercel

Este pacote contém o app completo, sem dependências para instalar e sem etapa de build.
Os dados e o login ficam no seu projeto Supabase.

## Publicar pelo GitHub

1. Extraia o ZIP.
2. Crie um repositório novo no GitHub, como tarefas-equipe.
3. Use Add file > Upload files (ou uploading an existing file num repositório vazio).
4. Envie TODOS os arquivos deste pacote para a raiz do repositório, incluindo vercel.json.
   O index.html deve estar na raiz, não dentro de uma subpasta.
   Não envie somente o ZIP: o GitHub não o extrai automaticamente.
5. Clique em Commit changes.
6. Na Vercel, clique em Add New > Project, importe o repositório e selecione Other.
7. Root Directory: raiz do repositório. Build Command: vazio (Override ativado, se necessário).
   Output Directory: ponto (.). O vercel.json também define essas opções.
8. Clique em Deploy e abra o endereço gerado.

## Conectar ao banco que você já configurou

1. No endereço novo da Vercel, abra Configurar conexão.
2. Cole a MESMA URL do projeto e a MESMA chave pública publishable/anon usadas antes.
3. Clique em Salvar conexão e entre com uma conta já autorizada da equipe.
4. Repita uma vez em cada navegador/dispositivo.

A configuração e a sessão do domínio anterior não são transferidas ao domínio Vercel.
Não precisa criar outro banco, recriar usuários ou executar novamente o SQL se a
configuração do Supabase já foi concluída. As tarefas existentes ficam no mesmo banco.
Não precisa configurar variáveis de ambiente na Vercel para esta versão.
Não use chaves secret ou service_role no app ou no repositório.

## Confirmar funcionamento

1. Crie uma tarefa com um nome identificável.
2. Recarregue o app: a tarefa deve continuar lá.
3. No Supabase, abra Table Editor > checklist_tasks e confira o registro.
4. Em outro dispositivo, configure o mesmo projeto e entre com outra conta autorizada.
5. Marque, edite ou exclua uma tarefa no primeiro dispositivo.
6. A mudança deve aparecer no segundo sem recarregar.

'Ao vivo' indica que o canal Realtime conectou. A validação completa exige conferir
leitura, gravação e atualização entre dispositivos. O app também faz uma verificação
periódica a cada 30 segundos para recuperar a lista; para verificar o tempo real,
a alteração deve aparecer rapidamente, sem depender dessa espera.

## Nova instalação do Supabase

Use supabase-setup.sql somente se ainda não tiver criado as tabelas e políticas.
Depois crie usuários no painel Authentication > Users e autorize seus e-mails:

```sql
insert into public.checklist_members (user_id)
select id from auth.users
where email in ('pessoa1@email.com', 'pessoa2@email.com', 'pessoa3@email.com')
on conflict do nothing;
```

Todos os membros autorizados podem ler, criar, concluir, editar e excluir todas as
tarefas da lista compartilhada. Visitantes sem login não têm acesso às tarefas.
As tarefas da demonstração não são salvas e somem ao recarregar.
