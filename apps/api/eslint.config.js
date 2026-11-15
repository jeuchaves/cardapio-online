import { configApp } from '@adonisjs/eslint-config'

export default configApp(
  // Gerado a cada migration (node ace migration:run); não é editado à mão
  { ignores: ['database/schema.ts'] },
  // Padrão idiomático do Japa: (await client.get(...)).assertStatus(...)
  { files: ['tests/**'], rules: { '@unicorn/no-await-expression-member': 'off' } }
)
