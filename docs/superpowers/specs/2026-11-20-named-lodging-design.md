# Quartos físicos e alocação do mapa

Lançar no sistema os 65 quartos CP01–CP56, SEM01/02/06 e PROF30/32/40/45/47/53 e as pessoas identificadas no mapa compartilhado. Nelsiana fica em CP17 e Neusa em CP44. Vincular pelo cadastro existente, usando CPF para homônimos; não alterar dados cadastrais nem financeiros. R$ 80 recebe `*` e a legenda exata `Não solicitou inscrição com quarto`, inclusive quando o mapa já atribui quarto.

Decisão de implementação: adicionar `named_rooms` ao plano existente, preservando o modo antigo quando a lista estiver vazia. Cada quarto tem chave estável, nome, local, andar e observações. A tela usa esses quartos diretamente, sem gerar quartos a partir dos coros. As atribuições permanecem no mesmo plano singleton; validar no servidor unicidade e capacidade máxima de três, contando pessoas avulsas. Mostrar os cadastros sem quarto e separar cancelados; não inventar quartos para quem não está no mapa. Registrar reservas sem identificação em observações.

Verificar parser, capacidade, hidratação sem sobrescrita, sinalização R$ 80, persistência e build. Publicar a alteração e gravar o mapa pelo Supabase CLI; conferir os dados persistidos e a tela publicada.
