import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import { authed, createRestaurantWithTeam, loginAndGetCookie, resetState } from '#tests/helpers'

const KEY_FROM_URL = /^\/uploads\/(restaurants\/.+)$/

function jpeg(size = 64) {
  const buffer = Buffer.alloc(size, 0x11)
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buffer)
  return buffer
}

function png(size = 64) {
  const buffer = Buffer.alloc(size, 0x22)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  return buffer
}

function riff(form: string, size = 64) {
  const buffer = Buffer.alloc(size, 0x33)
  buffer.write('RIFF', 0, 'latin1')
  buffer.writeUInt32LE(size - 8, 4)
  buffer.write(form, 8, 'latin1')
  return buffer
}

const webp = (size = 64) => riff('WEBP', size)

const storageRoot = () => app.makePath('tmp/test-storage')
const tmpUploads = () => app.tmpPath('uploads')

async function filesIn(dir: string) {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => `${entry.parentPath}/${entry.name}`)
  } catch {
    return []
  }
}

async function resetStorage() {
  await resetState()
  await rm(storageRoot(), { recursive: true, force: true })
  await rm(tmpUploads(), { recursive: true, force: true })
}

async function setup() {
  const team = await createRestaurantWithTeam()
  const [category] = await db
    .table('categories')
    .insert({ restaurant_id: team.restaurant.id, name: 'Lanches' })
    .returning('id')
  const [product] = await db
    .table('products')
    .insert({
      restaurant_id: team.restaurant.id,
      category_id: category.id,
      name: 'X-Burguer',
      price: '12.50',
    })
    .returning('id')
  return { ...team, productId: product.id as string }
}

const productImage = (restaurantId: string, productId: string) =>
  `/api/v1/tenant/${restaurantId}/products/${productId}/image`
const logoUrl = (restaurantId: string) => `/api/v1/tenant/${restaurantId}/restaurant/logo`

function keyOf(imageUrl: string) {
  const match = KEY_FROM_URL.exec(imageUrl)
  if (!match) throw new Error(`URL inesperada: ${imageUrl}`)
  return match[1]
}

async function dbImage(productId: string) {
  return (await db.from('products').where('id', productId).first()).image as string | null
}

test.group('Imagens | produto: upload, substituição e remoção', (group) => {
  group.each.setup(resetStorage)
  group.teardown(resetStorage)

  test('owner e staff enviam JPEG, PNG e WebP; só a chave vai ao banco; a URL é servida', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff, productId } = await setup()
    const cases = [
      { user: owner, buffer: png(), filename: 'foto.png', contentType: 'image/png', ext: 'png' },
      { user: staff, buffer: jpeg(), filename: 'foto.JPG', contentType: 'image/jpeg', ext: 'jpg' },
      { user: owner, buffer: jpeg(), filename: 'foto.jpeg', contentType: 'image/jpeg', ext: 'jpg' },
      {
        user: staff,
        buffer: webp(),
        filename: 'foto.webp',
        contentType: 'image/webp',
        ext: 'webp',
      },
    ]
    for (const item of cases) {
      const cookie = await loginAndGetCookie(client, item.user.email)
      const response = await authed(
        client,
        'put',
        productImage(restaurant.id, productId),
        cookie
      ).file('file', item.buffer, { filename: item.filename, contentType: item.contentType })
      response.assertStatus(200)

      const url: string = response.body().data.image_url
      const key = keyOf(url)
      assert.match(
        key,
        new RegExp(`^restaurants/${restaurant.id}/products/[0-9a-f-]{36}\\.${item.ext}$`)
      )
      // O banco guarda só a chave relativa
      assert.equal(await dbImage(productId), key)
      assert.isTrue(await drive.use().exists(key))

      // Servida sem autenticação, com o tipo definido pelo servidor
      const served = await client.get(url)
      served.assertStatus(200)
      assert.equal(served.header('content-type'), `image/${item.ext === 'jpg' ? 'jpeg' : item.ext}`)
      assert.equal(served.header('x-content-type-options'), 'nosniff')
      assert.equal(served.header('content-security-policy'), "default-src 'none'; sandbox")
      assert.isUndefined(served.header('set-cookie'))
      assert.isTrue(served.response.body.equals?.(item.buffer) ?? true)
    }
    // Cada troca apagou a imagem anterior: sobra um único arquivo
    assert.lengthOf(await filesIn(storageRoot()), 1)
  })

  test('substituir grava a nova, atualiza o banco e remove a antiga', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const put = (buffer: Buffer, filename: string, contentType: string) =>
      authed(client, 'put', productImage(restaurant.id, productId), cookie).file('file', buffer, {
        filename,
        contentType,
      })

    const first = await put(png(), 'a.png', 'image/png')
    const firstKey = keyOf(first.body().data.image_url)
    const second = await put(webp(), 'b.webp', 'image/webp')
    const secondKey = keyOf(second.body().data.image_url)

    assert.notEqual(firstKey, secondKey)
    assert.equal(await dbImage(productId), secondKey)
    assert.isFalse(await drive.use().exists(firstKey))
    assert.isTrue(await drive.use().exists(secondKey))
  })

  test('substituições simultâneas não deixam arquivo órfão', async ({ client, assert }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    for (let i = 0; i < 3; i++) {
      const responses = await Promise.all(
        [png(), jpeg(), webp()].map((buffer, index) =>
          authed(client, 'put', productImage(restaurant.id, productId), cookie).file(
            'file',
            buffer,
            {
              filename: ['a.png', 'b.jpg', 'c.webp'][index],
              contentType: ['image/png', 'image/jpeg', 'image/webp'][index],
            }
          )
        )
      )
      for (const response of responses) response.assertStatus(200)
      const stored = await dbImage(productId)
      const files = await filesIn(storageRoot())
      assert.lengthOf(files, 1)
      assert.isTrue(files[0].endsWith(stored!.split('/').pop()!))
    }
  })

  test('remover: owner apaga banco e arquivo; staff recebe 403; repetir é idempotente', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff, productId } = await setup()
    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const staffCookie = await loginAndGetCookie(client, staff.email)
    const url = productImage(restaurant.id, productId)
    const uploaded = await authed(client, 'put', url, ownerCookie).file('file', png(), {
      filename: 'a.png',
      contentType: 'image/png',
    })
    const key = keyOf(uploaded.body().data.image_url)

    ;(await authed(client, 'delete', url, staffCookie)).assertStatus(403)
    assert.equal(await dbImage(productId), key)
    assert.isTrue(await drive.use().exists(key))

    ;(await authed(client, 'delete', url, ownerCookie)).assertStatus(204)
    assert.isNull(await dbImage(productId))
    assert.isFalse(await drive.use().exists(key))
    ;(await authed(client, 'delete', url, ownerCookie)).assertStatus(204)

    const list = await authed(
      client,
      'get',
      `/api/v1/tenant/${restaurant.id}/products`,
      ownerCookie
    )
    assert.isNull(list.body().data[0].image_url)
  })

  test('excluir o produto também remove a imagem', async ({ client, assert }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    await authed(client, 'put', productImage(restaurant.id, productId), cookie).file(
      'file',
      png(),
      {
        filename: 'a.png',
        contentType: 'image/png',
      }
    )
    assert.lengthOf(await filesIn(storageRoot()), 1)
    ;(
      await authed(
        client,
        'delete',
        `/api/v1/tenant/${restaurant.id}/products/${productId}`,
        cookie
      )
    ).assertStatus(204)
    assert.lengthOf(await filesIn(storageRoot()), 0)
  })

  test('falha ao gravar no banco: o arquivo novo é removido e a imagem anterior fica intacta', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = productImage(restaurant.id, productId)
    const first = await authed(client, 'put', url, cookie).file('file', png(), {
      filename: 'a.png',
      contentType: 'image/png',
    })
    const keptKey = keyOf(first.body().data.image_url)

    await db.rawQuery(`
      CREATE FUNCTION test_fail_image() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'falha simulada'; END;
      $$ LANGUAGE plpgsql`)
    await db.rawQuery(`
      CREATE TRIGGER test_fail_image BEFORE UPDATE OF image ON products
      FOR EACH ROW EXECUTE FUNCTION test_fail_image()`)
    try {
      const failed = await authed(client, 'put', url, cookie).file('file', webp(), {
        filename: 'b.webp',
        contentType: 'image/webp',
      })
      failed.assertStatus(500)
      assert.notInclude(JSON.stringify(failed.body()), 'falha simulada')
      assert.equal(await dbImage(productId), keptKey)
      assert.isTrue(await drive.use().exists(keptKey))
      // Nenhum arquivo novo ficou para trás
      assert.lengthOf(await filesIn(storageRoot()), 1)

      // Remover também falha de forma controlada e preserva o arquivo
      ;(await authed(client, 'delete', url, cookie)).assertStatus(500)
      assert.isTrue(await drive.use().exists(keptKey))
    } finally {
      await db.rawQuery('DROP TRIGGER test_fail_image ON products')
      await db.rawQuery('DROP FUNCTION test_fail_image()')
    }
  })
})

test.group('Imagens | arquivos inválidos e limites', (group) => {
  group.each.setup(resetStorage)
  group.teardown(resetStorage)

  test('conteúdo, extensão e MIME precisam ser coerentes: 422 INVALID_IMAGE e nada é gravado', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = productImage(restaurant.id, productId)
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')

    const bad: [string, Buffer, string, string][] = [
      [
        'texto com extensão e MIME de imagem',
        Buffer.from('não sou uma imagem'),
        'a.png',
        'image/png',
      ],
      [
        'HTML disfarçado de JPEG',
        Buffer.from('<html><script>alert(1)</script></html>'),
        'a.jpg',
        'image/jpeg',
      ],
      ['SVG', svg, 'a.svg', 'image/svg+xml'],
      ['SVG com extensão e MIME de PNG', svg, 'a.png', 'image/png'],
      ['PNG com extensão .jpg', png(), 'a.jpg', 'image/png'],
      ['PNG com MIME de JPEG', png(), 'a.png', 'image/jpeg'],
      ['JPEG com extensão .webp', jpeg(), 'a.webp', 'image/jpeg'],
      ['sem extensão', png(), 'arquivo', 'image/png'],
      ['extensão dupla', png(), 'a.png.exe', 'image/png'],
      ['RIFF que não é WebP (WAVE)', riff('WAVE'), 'a.webp', 'image/webp'],
      ['RIFF truncado', riff('WEBP').subarray(0, 10), 'a.webp', 'image/webp'],
      ['GIF', Buffer.from('GIF89a......'), 'a.gif', 'image/gif'],
      ['PNG truncado', png().subarray(0, 5), 'a.png', 'image/png'],
      ['arquivo vazio', Buffer.alloc(0), 'a.png', 'image/png'],
      ['executável', Buffer.from('MZ\x90\x00'), 'a.png', 'image/png'],
    ]
    for (const [label, buffer, filename, contentType] of bad) {
      const response = await authed(client, 'put', url, cookie).file('file', buffer, {
        filename,
        contentType,
      })
      assert.equal(response.status(), 422, label)
      assert.equal(response.body().code, 'INVALID_IMAGE', label)
    }
    assert.isNull(await dbImage(productId))
    assert.lengthOf(await filesIn(storageRoot()), 0)
    assert.lengthOf(await filesIn(tmpUploads()), 0)
  })

  test('envio malformado: sem arquivo, arquivo duplicado, campo errado, campos extras, JSON', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = productImage(restaurant.id, productId)
    const file = (name: string) => ({
      name,
      buffer: png(),
      options: { filename: 'a.png', contentType: 'image/png' },
    })

    const responses = [
      await authed(client, 'put', url, cookie),
      await authed(client, 'put', url, cookie).json({ file: 'x' }),
      await authed(client, 'put', url, cookie).field('note', 'x'),
      await authed(client, 'put', url, cookie).file(
        file('image').name,
        file('image').buffer,
        file('image').options
      ),
      await authed(client, 'put', url, cookie)
        .file('file', png(), file('x').options)
        .file('other', png(), file('x').options),
      await authed(client, 'put', url, cookie)
        .file('file', png(), file('x').options)
        .field('restaurant_id', restaurant.id),
    ]
    for (const response of responses) {
      assert.include([422], response.status())
      assert.equal(
        response.body().code,
        response.body().code === 'INVALID_IMAGE' ? 'INVALID_IMAGE' : 'VALIDATION_ERROR'
      )
    }
    assert.isNull(await dbImage(productId))
    assert.lengthOf(await filesIn(storageRoot()), 0)
    assert.lengthOf(await filesIn(tmpUploads()), 0)
  })

  test('tamanho: 5 MB exatos passam; acima disso é 422; muito acima é 413; sem arquivo temporário', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = productImage(restaurant.id, productId)
    const put = (size: number) =>
      authed(client, 'put', url, cookie).file('file', png(size), {
        filename: 'a.png',
        contentType: 'image/png',
      })

    ;(await put(5 * 1024 * 1024)).assertStatus(200)
    const tooBig = await put(5 * 1024 * 1024 + 1)
    tooBig.assertStatus(422)
    assert.equal(tooBig.body().code, 'INVALID_IMAGE')
    const huge = await put(7 * 1024 * 1024)
    huge.assertStatus(413)
    assert.equal(huge.body().code, 'PAYLOAD_TOO_LARGE')

    // Só a imagem de 5 MB ficou gravada; nada sobrou na pasta temporária
    assert.lengthOf(await filesIn(storageRoot()), 1)
    assert.lengthOf(await filesIn(tmpUploads()), 0)
  })

  test('requisições recusadas antes do controller também não deixam temporários', async ({
    client,
    assert,
  }) => {
    const { restaurant, staff, productId } = await setup()
    const other = await setup()
    const staffCookie = await loginAndGetCookie(client, staff.email)
    const upload = (url: string, cookie?: string) => {
      const request = cookie
        ? authed(client, 'put', url, cookie)
        : client.put(url).header('Origin', 'http://localhost:3000')
      return request.file('file', png(), { filename: 'a.png', contentType: 'image/png' })
    }

    // Sem sessão, restaurante alheio, produto inexistente e logo como staff
    ;(await upload(productImage(restaurant.id, productId))).assertStatus(401)
    ;(await upload(productImage(other.restaurant.id, other.productId), staffCookie)).assertStatus(
      404
    )
    ;(await upload(productImage(restaurant.id, randomUUID()), staffCookie)).assertStatus(404)
    ;(await upload(logoUrl(restaurant.id), staffCookie)).assertStatus(403)
    // Sem Origin
    ;(
      await client
        .put(productImage(restaurant.id, productId))
        .file('file', png(), { filename: 'a.png', contentType: 'image/png' })
    ).assertStatus(403)

    assert.lengthOf(await filesIn(storageRoot()), 0)
    assert.lengthOf(await filesIn(tmpUploads()), 0)
  })

  test('multipart em outras rotas não é processado nem gravado em disco', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const response = await authed(
      client,
      'post',
      `/api/v1/tenant/${restaurant.id}/categories`,
      cookie
    )
      .field('name', 'Nova')
      .file('file', png(), { filename: 'a.png', contentType: 'image/png' })
    assert.equal(response.status(), 422)
    assert.lengthOf(await filesIn(tmpUploads()), 0)
  })
})

test.group('Imagens | logo do restaurante', (group) => {
  group.each.setup(resetStorage)
  group.teardown(resetStorage)

  test('owner envia e substitui o logo; staff recebe 403; inválido é 422', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff } = await setup()
    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const staffCookie = await loginAndGetCookie(client, staff.email)
    const url = logoUrl(restaurant.id)
    const put = (cookie: string, buffer: Buffer, filename: string, contentType: string) =>
      authed(client, 'put', url, cookie).file('file', buffer, { filename, contentType })

    ;(await put(staffCookie, png(), 'a.png', 'image/png')).assertStatus(403)
    assert.lengthOf(await filesIn(storageRoot()), 0)
    ;(await put(ownerCookie, Buffer.from('texto'), 'a.png', 'image/png')).assertStatus(422)

    const first = await put(ownerCookie, png(), 'a.png', 'image/png')
    first.assertStatus(200)
    const firstKey = keyOf(first.body().data.logo_url)
    assert.match(firstKey, new RegExp(`^restaurants/${restaurant.id}/logo/[0-9a-f-]{36}\\.png$`))
    assert.equal((await db.from('restaurants').where('id', restaurant.id).first()).logo, firstKey)

    const second = await put(ownerCookie, webp(), 'b.webp', 'image/webp')
    const secondKey = keyOf(second.body().data.logo_url)
    assert.isFalse(await drive.use().exists(firstKey))
    assert.isTrue(await drive.use().exists(secondKey))
    assert.lengthOf(await filesIn(storageRoot()), 1)

    const shown = await authed(
      client,
      'get',
      `/api/v1/tenant/${restaurant.id}/restaurant`,
      staffCookie
    )
    assert.equal(shown.body().data.logo_url, `/uploads/${secondKey}`)
    assert.notProperty(shown.body().data, 'logo')
    ;(await client.get(`/uploads/${secondKey}`)).assertStatus(200)
  })

  test('isolamento: usuário de A não envia imagem para o restaurante nem para o produto de B', async ({
    client,
    assert,
  }) => {
    const a = await setup()
    const b = await setup()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const upload = (url: string) =>
      authed(client, 'put', url, cookie).file('file', png(), {
        filename: 'a.png',
        contentType: 'image/png',
      })

    ;(await upload(logoUrl(b.restaurant.id))).assertStatus(404)
    ;(await upload(productImage(b.restaurant.id, b.productId))).assertStatus(404)
    // Produto de B pelo próprio restaurante A
    ;(await upload(productImage(a.restaurant.id, b.productId))).assertStatus(404)
    ;(
      await authed(client, 'delete', productImage(a.restaurant.id, b.productId), cookie)
    ).assertStatus(404)

    assert.isNull(await dbImage(b.productId))
    assert.isNull((await db.from('restaurants').where('id', b.restaurant.id).first()).logo)
    assert.lengthOf(await filesIn(storageRoot()), 0)
    assert.lengthOf(await filesIn(tmpUploads()), 0)

    // A chave sempre vem do restaurante autorizado
    const own = await upload(productImage(a.restaurant.id, a.productId))
    assert.include(keyOf(own.body().data.image_url), `restaurants/${a.restaurant.id}/products/`)
  })
})

test.group('Imagens | leitura pública (/uploads)', (group) => {
  group.each.setup(resetStorage)
  group.teardown(resetStorage)

  test('só serve chaves no formato estrito; sem listagem, traversal nem outros arquivos', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, productId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const uploaded = await authed(
      client,
      'put',
      productImage(restaurant.id, productId),
      cookie
    ).file('file', png(), { filename: 'a.png', contentType: 'image/png' })
    const key = keyOf(uploaded.body().data.image_url)
    ;(await client.get(`/uploads/${key}`)).assertStatus(200)

    // Arquivos que existem no disco, mas não têm o formato de uma imagem do sistema
    const dir = `${storageRoot()}/restaurants/${restaurant.id}/products`
    await mkdir(dir, { recursive: true })
    const stray = `restaurants/${restaurant.id}/products/${randomUUID()}`
    await writeFile(`${storageRoot()}/${stray}.txt`, 'segredo')
    await writeFile(`${storageRoot()}/${stray}.svg`, '<svg/>')
    await writeFile(`${storageRoot()}/restaurants/${restaurant.id}/products/nota.png`, 'x')
    await writeFile(`${storageRoot()}/segredo.png`, 'x')

    const uuid = randomUUID()
    const paths = [
      '/uploads',
      '/uploads/',
      '/uploads/restaurants',
      `/uploads/restaurants/${restaurant.id}`,
      `/uploads/restaurants/${restaurant.id}/products`,
      `/uploads/restaurants/${restaurant.id}/products/`,
      `/uploads/${stray}.txt`,
      `/uploads/${stray}.svg`,
      `/uploads/restaurants/${restaurant.id}/products/nota.png`,
      '/uploads/segredo.png',
      `/uploads/${key.toUpperCase()}`,
      `/uploads/${key}.txt`,
      `/uploads/restaurants/${restaurant.id}/other/${uuid}.png`,
      `/uploads/restaurants/${restaurant.id}/products/${uuid}.png`,
      `/uploads/restaurants/${restaurant.id}/products/../products/${key.split('/').pop()}`,
      `/uploads/../.env`,
      `/uploads/%2e%2e/.env`,
      `/uploads/restaurants/%2e%2e/%2e%2e/.env`,
      `/uploads/restaurants%2F${restaurant.id}%2Fproducts%2Fx.png`,
      '/uploads/%00',
    ]
    for (const path of paths) {
      const response = await client.get(path)
      assert.equal(response.status(), 404, path)
      assert.notInclude(response.text(), 'segredo', path)
    }
    // Só leitura
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const response = await client[method](`/uploads/${key}`)
      assert.include([404, 405], response.status(), method)
    }
    assert.isTrue(await drive.use().exists(key))
  })
})
