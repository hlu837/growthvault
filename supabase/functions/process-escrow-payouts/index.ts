import { createClient } from 'jsr:@supabase/supabase-js@2'

interface Order {
  id: string
  order_number: string
  order_status: string
  is_escrow_paused: boolean
  notes: string | null
  total_escrow_hold_amount: string | number
  product_id: string
  user_id: string
  marketplace_products?: {
    created_by: string
    currency?: string
  }
}

const generateReceiptNumber = () => {
  const now = new Date()
  const year = now.getFullYear()
  const suffix = `${now.getTime().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`
  return `RCP-${year}-${suffix}`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // Query all marketplace_orders in inspection status with escrow not paused
    const { data: orders, error: queryError } = await supabase
      .from('marketplace_orders')
      .select('id, order_status, is_escrow_paused, notes')
      .eq('order_status', 'inspection')
      .eq('is_escrow_paused', false)

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(JSON.stringify({ error: 'Failed to query orders' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ message: 'No orders to process' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const now = new Date()
    const ordersToUpdate: string[] = []

    // Check each order for expired inspection window
    for (const order of orders as Order[]) {
      if (!order.notes) continue

      try {
        const notes = JSON.parse(order.notes)
        const inspectionExpiresAt = notes.inspection_window_expires_at

        if (!inspectionExpiresAt) continue

        const expiresAt = new Date(inspectionExpiresAt)

        if (now >= expiresAt) {
          ordersToUpdate.push(order.id)
        }
      } catch (parseError) {
        console.error(`Failed to parse notes for order ${order.id}:`, parseError)
        continue
      }
    }

    if (ordersToUpdate.length === 0) {
      return new Response(JSON.stringify({ message: 'No orders ready for confirmation' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update orders to confirmed status
    const { data: updateData, error: updateError } = await supabase
      .from('marketplace_orders')
      .update({
        order_status: 'confirmed',
        payment_status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .in('id', ordersToUpdate)
      .select('id, order_number, total_escrow_hold_amount, notes, product_id, user_id, marketplace_products(created_by,currency)')

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to update orders' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const sellerOrderCounts = new Map<string, number>()

    if (updateData && Array.isArray(updateData)) {
      const receipts = updateData
        .map((order: Order) => {
          const sellerId = order.marketplace_products?.created_by
          if (!sellerId) return null

          sellerOrderCounts.set(sellerId, (sellerOrderCounts.get(sellerId) || 0) + 1)

          let notes = {} as any
          try {
            notes = order.notes ? JSON.parse(order.notes) : {}
          } catch {
            notes = {}
          }

          return {
            receipt_number: generateReceiptNumber(),
            order_id: order.id,
            user_id: sellerId,
            receipt_type: 'final_release',
            receipt_title: 'Escrow Release Receipt',
            amount: Number(order.total_escrow_hold_amount) || Number(notes.escrow_amount) || 0,
            currency: order.marketplace_products?.currency || notes.currency || 'USD',
            receipt_data: {
              transaction_id: order.order_number,
              order_id: order.id,
              payout_amount: Number(order.total_escrow_hold_amount) || Number(notes.escrow_amount) || 0,
              commission_deducted: Number(notes.commission_deducted) || 0,
              total_amount: Number(notes.total_amount) || 0,
              buyer_id: order.user_id,
              product_id: order.product_id,
              confirmed_at: new Date().toISOString(),
            },
            created_at: new Date().toISOString(),
          }
        })
        .filter(Boolean)

      if (receipts.length > 0) {
        const { error: receiptError } = await supabase.from('receipts').insert(receipts)
        if (receiptError) {
          console.error('Receipt insert error:', receiptError)
          return new Response(JSON.stringify({ error: 'Failed to insert payout receipts' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }

    if (sellerOrderCounts.size > 0) {
      const sellerIds = Array.from(sellerOrderCounts.keys())
      const { data: sellerProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, risk_score')
        .in('id', sellerIds)

      if (profileError) {
        console.error('Profile query error:', profileError)
      } else if (sellerProfiles && sellerProfiles.length > 0) {
        await Promise.all(
          sellerProfiles.map((profile: any) => {
            const count = sellerOrderCounts.get(profile.id) || 0
            const currentScore = Number(profile.risk_score ?? 0)
            const newScore = Math.max(currentScore - count * 5, 0)
            return supabase
              .from('profiles')
              .update({ risk_score: newScore })
              .eq('id', profile.id)
          })
        )
      }
    }

    console.log(`Auto-confirmed ${ordersToUpdate.length} orders:`, ordersToUpdate)
    console.log(`Adjusted risk_score for ${sellerOrderCounts.size} seller(s) after successful dispute-free confirmations.`)

    return new Response(JSON.stringify({
      message: `Successfully processed ${ordersToUpdate.length} escrow payouts`,
      updatedOrders: ordersToUpdate
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})