# Avisos de novas tarefas

Cada pessoa entra com sua conta e toca em **Ativar notificações** no celular. Ao tocar no aviso, abre os detalhes da tarefa. O autor não recebe o próprio aviso. Sair desativa os avisos naquele navegador.

## Configuração do administrador

1. Configure estas variáveis na Vercel, no projeto tarefas-nucleo, ambiente Production:
   - PUSH_PUBLIC_KEY: chave pública VAPID.
   - PUSH_PRIVATE_KEY: chave privada do mesmo par VAPID, protegida.
   - PUSH_WEBHOOK_SECRET: segredo aleatório, protegido.
2. No Supabase, abra SQL Editor → New query, cole todo o setup-notificacoes.sql e execute com Run.
3. Salve o mesmo PUSH_WEBHOOK_SECRET no Supabase Vault com o nome checklist_push_webhook_secret. Use o comando abaixo substituindo o valor indicado. Se já existir, atualize o segredo em vez de criar outro.

```sql
select vault.create_secret(
 'COLE_AQUI_O_MESMO_PUSH_WEBHOOK_SECRET_DA_VERCEL',
 'checklist_push_webhook_secret',
 'Autorização de notificações para a Vercel'
);
```

4. Na Vercel, faça Redeploy do último deploy para aplicar as variáveis.
5. Entre em dois celulares com contas autorizadas. Ative os avisos no segundo. Crie uma tarefa no primeiro e confira o aviso no segundo, inclusive com o app fechado. Toque para abrir a tarefa.

Não publique os valores privados no GitHub. Não use anon ou service_role como segredo de envio. Para gerar suas próprias chaves, execute localmente `node gerar-chaves-notificacoes.cjs`. Guarde a saída somente para configurar Vercel e Vault.

## Aparelhos e diagnóstico

- Android: use um navegador compatível e permita notificações.
- iPhone/iPad: adicione o site à tela de início e abra pelo ícone antes de ativar (iOS/iPadOS 16.4 ou posterior).
- Os avisos dependem da internet, permissões e configurações do aparelho. São notificações do app; não são mensagens no WhatsApp.
- Edições, conclusão e exclusão não geram avisos.
- Sem configuração, as tarefas continuam funcionando e o envio fica inativo.
- O envio usa pg_net de forma assíncrona. Não há garantia de entrega nem nova tentativa automática. Inscrições expiradas precisam ser reativadas no aparelho.

Consulte respostas recentes no SQL Editor:

```sql
select id,status_code,timed_out,error_msg,created
from net._http_response order by created desc limit 10;
```

200 indica processamento pelo servidor, sem garantir exibição no aparelho; 401 indica segredos diferentes; 503, variáveis ausentes; 502, falha em parte dos envios. Sem destinatários inscritos, nenhum pedido é feito.

As inscrições têm acesso restrito à própria conta. Só membros atuais recebem avisos. As chaves privadas ficam no servidor e não fazem parte dos arquivos do app.
