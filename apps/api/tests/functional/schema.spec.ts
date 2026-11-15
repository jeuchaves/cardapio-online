import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { createRestaurant, createUser, link, resetState } from '#tests/helpers'

const NOW = new Date()

// Códigos do PostgreSQL: 23505 unique, 23514 check, 23503 foreign key
async function pgCode(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return null
}

function insertRestaurant(values: Record<string, unknown>) {
  return db
    .table('restaurants')
    .insert({ name: 'Teste', created_at: NOW, updated_at: NOW, ...values })
}

test.group('Schema | identidade e tenant', (group) => {
  group.each.setup(resetState)

  test('slug: formato, tamanho mínimo e unicidade', async ({ assert }) => {
    for (const slug of ['AB-CD', 'ab', 'a--b', '-ab', 'ab-', 'com espaco', 'a_b_c']) {
      assert.equal(await pgCode(() => insertRestaurant({ slug })), '23514', slug)
    }
    assert.equal(await pgCode(() => insertRestaurant({ slug: 'a'.repeat(61) })), '22001')

    await insertRestaurant({ slug: 'casa-do-sabor' })
    assert.equal(await pgCode(() => insertRestaurant({ slug: 'casa-do-sabor' })), '23505')
  })

  test('restaurante: ao menos uma modalidade e um método de pagamento', async ({ assert }) => {
    const base = { slug: 'valido' }
    assert.equal(
      await pgCode(() =>
        insertRestaurant({ ...base, accepts_dine_in: false, accepts_pickup: false })
      ),
      '23514'
    )
    assert.equal(
      await pgCode(() =>
        insertRestaurant({
          ...base,
          accepts_cash: false,
          accepts_card: false,
          accepts_pix: false,
        })
      ),
      '23514'
    )
  })

  test('e-mail é único sem distinção entre maiúsculas e minúsculas', async ({ assert }) => {
    await createUser({ email: 'dono@exemplo.com' })
    const code = await pgCode(() =>
      db.table('users').insert({
        name: 'Outro',
        email: 'DONO@Exemplo.com',
        password: 'x',
        created_at: NOW,
        updated_at: NOW,
      })
    )
    assert.equal(code, '23505')
  })

  test('vínculo: papel válido, único por restaurante e usuário', async ({ assert }) => {
    const user = await createUser()
    const restaurant = await createRestaurant()
    await link(user, restaurant, 'owner')

    assert.equal(await pgCode(() => link(user, restaurant, 'staff')), '23505')

    const other = await createRestaurant()
    const code = await pgCode(() =>
      db.table('restaurant_users').insert({
        restaurant_id: other.id,
        user_id: user.id,
        role: 'manager',
        created_at: NOW,
        updated_at: NOW,
      })
    )
    assert.equal(code, '23514')
  })

  test('FKs RESTRICT: não exclui usuário nem restaurante com vínculo', async ({ assert }) => {
    const user = await createUser()
    const restaurant = await createRestaurant()
    await link(user, restaurant, 'owner')

    assert.equal(await pgCode(() => db.from('users').where('id', user.id).delete()), '23503')
    assert.equal(
      await pgCode(() => db.from('restaurants').where('id', restaurant.id).delete()),
      '23503'
    )
  })

  test('sessions: colunas do driver database oficial', async ({ assert }) => {
    const columns = await db
      .from('information_schema.columns')
      .where('table_name', 'sessions')
      .select('column_name', 'is_nullable')
    const byName = Object.fromEntries(columns.map((c) => [c.column_name, c.is_nullable]))
    assert.deepEqual(byName, { id: 'NO', data: 'NO', user_id: 'YES', expires_at: 'NO' })
  })
})
