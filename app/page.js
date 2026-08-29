'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const cottages = [
  ['standard', 'Standard Cottage', 4],
  ['luxury', 'Luxury Cottage', 4],
  ['superior', 'Superior Cottage', 8],
  ['premier', 'Premier Cottage', 4],
];

const cats = [
  'Cleaning',
  'Laundry',
  'Barbecue / Wood',
  'Pool Maintenance',
  'General Maintenance',
  'Guest Food',
  'Guesthouse Beverages',
  'Replacements',
  'Linen',
  'Wages',
  'Essentials',
  'Other',
];

const money = n =>
  'R ' +
  Number(n || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [page, setPage] = useState('Dashboard');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [calMonth, setCalMonth] = useState(currentMonth());
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState('');
  const [data, setData] = useState({
    bookings: [],
    payments: [],
    restaurant: [],
    expenses: [],
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function load() {
    const [{ data: p }, { data: b }, { data: pay }, { data: r }, { data: e }] =
      await Promise.all([
        supabase.from('profiles').select('role,display_name').single(),
        supabase.from('bookings').select('*').order('check_in'),
        supabase.from('payments').select('*'),
        supabase
          .from('restaurant_transactions')
          .select('*')
          .order('entry_date', { ascending: false }),
        supabase
          .from('guest_house_expenses')
          .select('*')
          .order('expense_date', { ascending: false }),
      ]);

    setRole(p?.role || 'viewer');
    setDisplayName(p?.display_name || '');
    setData({
      bookings: b || [],
      payments: pay || [],
      restaurant: r || [],
      expenses: e || [],
    });
  }

  if (!session) return <Login />;

  const admin = role === 'admin';

  const paid = id =>
    data.payments
      .filter(x => x.booking_id === id)
      .reduce((s, x) => s + Number(x.amount), 0);

  const cottageIncome = data.bookings.reduce(
    (s, b) => s + Number(b.total_price || 0),
    0
  );

  const cottageExpenses = data.expenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  const restaurantIncome = data.restaurant
    .filter(x => x.entry_type === 'income')
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const restaurantExpenses = data.restaurant
    .filter(x => x.entry_type === 'expense')
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const totalIncome = cottageIncome + restaurantIncome;
  const totalExpenses = cottageExpenses + restaurantExpenses;

  async function remove(table, id) {
    if (!admin) return;
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    const { error } = await supabase.from(table).delete().eq('id', id);

    if (error) {
      alert(error.message);
      return;
    }

    load();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
  <img
  src="/1CDC0848-6165-449F-A4CA-948875692274.png"
  alt="Ludicks Farm"
  style={{
    width: '300px',
    maxWidth: '100%',
    height: 'auto',
    display: 'block',
    objectFit: 'contain',
  }}
/>
  <small>Management System</small>
</div>

        <div className="user">
          <strong>{displayName || (admin ? 'Admin' : 'Local')}</strong>
          <br />
          <small>{admin ? 'Administrator' : 'View Only'}</small>
          <br />
          <button className="btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="nav">
        {[
          'Dashboard',
          'Bookings',
          'Restaurant',
          'Guest House Expenses',
          'Occupancy',
          'Financial Summary',
        ].map(x => (
          <button
            key={x}
            className={page === x ? 'active' : ''}
            onClick={() => setPage(x)}
          >
            {x}
          </button>
        ))}
      </nav>

      <main>
        {!admin && (
          <div className="notice">
            You are signed in with view-only access. Only the Admin can make
            changes.
          </div>
        )}

        {page === 'Dashboard' && (
          <>
            <div className="cards">
              <Stat t="Total income" v={money(totalIncome)} />
              <Stat t="Total expenses" v={money(totalExpenses)} />
              <Stat t="Profit / Loss" v={money(totalIncome - totalExpenses)} />
              <Stat
                t="Outstanding"
                v={money(
                  data.bookings.reduce(
                    (s, b) =>
                      s +
                      Math.max(0, Number(b.total_price || 0) - paid(b.id)),
                    0
                  )
                )}
              />
            </div>

            <section className="calendar-section">
              <h2>Cottage Calendars</h2>
              <p>
                Highlighted dates indicate that guests are staying in the
                cottage.
              </p>

              <div className="calendar-grid-wrap">
                {cottages.map(c => (
                  <CottageCalendar
                    key={c[0]}
                    cottage={c}
                    bookings={data.bookings}
                    paid={paid}
                    month={calMonth}
                    setMonth={setCalMonth}
                  />
                ))}

                <CombinedCalendar
                  bookings={data.bookings}
                  month={calMonth}
                  setMonth={setCalMonth}
                />
              </div>
            </section>

            <div className="actions">
              <h2>Bookings</h2>
              {admin && (
                <button
                  className="btn primary"
                  onClick={() => setModal({ type: 'booking' })}
                >
                  Add Booking
                </button>
              )}
            </div>

            <BookingTable
              rows={[...data.bookings].sort((a, b) => new Date(b.check_in) - new Date(a.check_in))}
              paid={paid}
              admin={admin}
              edit={x => setModal({ type: 'booking', x })}
              remove={id => remove('bookings', id)}
              payment={x => setModal({ type: 'payment', x })}
            />
          </>
        )}

        {page === 'Bookings' && (
          <>
            <div className="actions">
              <h2>Bookings</h2>
              {admin && (
                <button
                  className="btn primary"
                  onClick={() => setModal({ type: 'booking' })}
                >
                  Add Booking
                </button>
              )}
            </div>
<div className="filters">
  <select
    value={bookingFilter}
    onChange={e => setBookingFilter(e.target.value)}
  >
    <option value="all">All Bookings</option>
    <option value="past">Past Bookings</option>
    <option value="present">Present Bookings</option>
    <option value="future">Future Bookings</option>
  </select>
</div>
            <BookingTable
              rows={[...data.bookings]
  .filter(b => {
    const today = new Date().toISOString().slice(0, 10);

    if (bookingFilter === 'past') {
      return b.check_out <= today;
    }

    if (bookingFilter === 'present') {
      return b.check_in <= today && b.check_out > today;
    }

    if (bookingFilter === 'future') {
      return b.check_in > today;
    }

    return true;
  })
  .sort((a, b) => new Date(b.check_in) - new Date(a.check_in))}
              paid={paid}
              admin={admin}
              edit={x => setModal({ type: 'booking', x })}
              remove={id => remove('bookings', id)}
              payment={x => setModal({ type: 'payment', x })}
            />
          </>
        )}

        {page === 'Restaurant' && (
          <Restaurant
            rows={data.restaurant}
            admin={admin}
            add={() => setModal({ type: 'restaurant' })}
            edit={x => setModal({ type: 'restaurant', x })}
            remove={id => remove('restaurant_transactions', id)}
          />
        )}

        {page === 'Guest House Expenses' && (
          <Expenses
            rows={data.expenses}
            admin={admin}
            add={() => setModal({ type: 'expense' })}
            edit={x => setModal({ type: 'expense', x })}
            remove={id => remove('guest_house_expenses', id)}
          />
        )}

        {page === 'Occupancy' && <Occupancy bookings={data.bookings} />}

        {page === 'Financial Summary' && (
          <FinancialSummary
  bookings={data.bookings}
payments={data.payments}
  restaurant={data.restaurant}
  expenses={data.expenses}
/>
        )}
      </main>

      {modal && (
        <Modal
          modal={modal}
          close={() => setModal(null)}
          reload={load}
          setErr={setErr}
        />
      )}

      {err && <div>{err}</div>}
    </div>
  );
}

function Stat({ t, v }) {
  return (
    <div className="stat">
      <div className="label">{t}</div>
      <div className="value">{v}</div>
    </div>
  );
}

function BookingTable({ rows, paid, admin, edit, remove, payment }) {
  return (
    <div className="panel">
  <Table
  rowStyles={rows.map(b => {
    const today = new Date().toISOString().slice(0, 10);

    if (b.check_out <= today) {
      return { backgroundColor: '#ffd6d6' };
    }

    if (b.check_in > today) {
      return { backgroundColor: '#d9f5df' };
    }

    return {};
  })}
  head={[
          'Guest',
          'Phone',
          'Cottage',
          'Dates',
          'Guests',
          'Total',
          'Paid',
          'Balance',
          '',
        ]}
        rows={rows.map(b => [
          b.guest_name,
          b.phone || '—',
          cottages.find(c => c[0] === b.cottage_id)?.[1] || b.cottage_id,
          b.check_in + ' → ' + b.check_out,
          b.guests,
          money(b.total_price),
          money(paid(b.id)),
          money(Math.max(0, Number(b.total_price || 0) - paid(b.id))),
          admin && (
            <>
              <button className="btn" onClick={() => edit(b)}>
                Edit
              </button>
              <button className="btn" onClick={() => payment(b)}>
                Payment
              </button>
              <button className="btn danger" onClick={() => remove(b.id)}>
                Delete
              </button>
            </>
          ),
        ])}
      />
    </div>
  );
}

function CottageCalendar({
  cottage,
  bookings,
  paid,
  month,
  setMonth,
}) {
  const [selected, setSelected] = useState(null);
  const cells = monthCells(month);

  function changeMonth(amount) {
    setMonth(shiftMonth(month, amount));
    setSelected(null);
  }

  return (
    <div className="calendar-card">
      <div className="calendar-title">
        <div>
          <h3>{cottage[1]}</h3>
          <small>Capacity: {cottage[2]} guests</small>
        </div>

        <div className="month-controls">
          <button onClick={() => changeMonth(-1)}>‹</button>
          <strong>{monthLabel(month)}</strong>
          <button onClick={() => changeMonth(1)}>›</button>
        </div>
      </div>

      <Weekdays />

      <div className="month-grid">
        {cells.map((date, i) => {
          if (!date) return <div className="day blank" key={'b' + i} />;

          const bookingsHere = bookings.filter(
            b =>
              b.cottage_id === cottage[0] &&
              b.check_in <= date &&
              b.check_out > date
          );

          const occupied = bookingsHere.length > 0;

          return (
            <button
              type="button"
              key={date}
              className={'day' + (occupied ? ' occupied' : '')}
              onClick={() =>
                occupied ? setSelected(bookingsHere[0]) : setSelected(null)
              }
            >
              <div className="day-number">
                {Number(date.slice(-2))}
              </div>

              {bookingsHere.map(b => (
                <div className="booking-mini" key={b.id}>
                  {b.guest_name}
                </div>
              ))}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="booking-details">
          <strong>{selected.guest_name}</strong>
          <br />
          Phone: {selected.phone || 'Not supplied'}
          <br />
          Guests: {selected.guests}
          <br />
          Stay: {selected.check_in} → {selected.check_out}
          <br />
          Total: {money(selected.total_price)}
          <br />
          Paid: {money(paid(selected.id))}
          <br />
          Balance:{' '}
          {money(
            Math.max(
              0,
              Number(selected.total_price || 0) - paid(selected.id)
            )
          )}
        </div>
      )}
    </div>
  );
}

function CombinedCalendar({ bookings, month, setMonth }) {
  const cells = monthCells(month);

  function changeMonth(amount) {
    setMonth(shiftMonth(month, amount));
  }

  return (
    <div className="calendar-card combined">
      <div className="calendar-title">
        <div>
          <h3>Combined Cottage Calendar</h3>
          <small>All four cottages</small>
        </div>

        <div className="month-controls">
          <button onClick={() => changeMonth(-1)}>‹</button>
          <strong>{monthLabel(month)}</strong>
          <button onClick={() => changeMonth(1)}>›</button>
        </div>
      </div>

      <Weekdays />

      <div className="month-grid">
        {cells.map((date, i) => {
          if (!date) return <div className="day blank" key={'c' + i} />;

          const occupiedCount = cottages.filter(c =>
            bookings.some(
              b =>
                b.cottage_id === c[0] &&
                b.check_in <= date &&
                b.check_out > date
            )
          ).length;

          const occupied = occupiedCount > 0;

          return (
            <div
              className={'day' + (occupied ? ' occupied' : '')}
              key={date}
            >
              <div className="day-number">
                {Number(date.slice(-2))}
              </div>

              <div
                className={'status ' + (occupied ? 'occupied' : 'empty')}
              >
                {occupied ? 'Occupied' : 'Empty'}
              </div>

              {occupied && (
                <div className="status">
                  {occupiedCount} occupied · {4 - occupiedCount} empty
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Weekdays() {
  return (
    <div className="weekdays">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => (
        <div className="weekday" key={x}>
          {x}
        </div>
      ))}
    </div>
  );
}

function monthCells(month) {
  const [year, m] = month.split('-').map(Number);
  const days = new Date(year, m, 0).getDate();
  const first = new Date(year, m - 1, 1).getDay();
  const mondayOffset = (first + 6) % 7;

  const cells = Array(mondayOffset).fill(null);

  for (let d = 1; d <= days; d++) {
    cells.push(
      `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }

  while (cells.length % 7) cells.push(null);

  return cells;
}

function shiftMonth(month, amount) {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + amount, 1);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [year, m] = month.split('-').map(Number);

  return new Date(year, m - 1, 1).toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });
}

function Restaurant({ rows, admin, add, edit, remove }) {
  return (
    <>
      <div className="actions">
        <h2>Restaurant Income & Expenses</h2>
        {admin && (
          <button className="btn primary" onClick={add}>
            Add Entry
          </button>
        )}
      </div>

      <div className="panel">
        <Table
          head={['Date', 'Description', 'Type', 'Amount', '']}
          rows={rows.map(x => [
            x.entry_date,
            x.description,
            x.entry_type === 'income' ? 'Income' : 'Expense',
            money(x.amount),
            admin && (
              <>
                <button className="btn" onClick={() => edit(x)}>
                  Edit
                </button>
                <button className="btn danger" onClick={() => remove(x.id)}>
                  Delete
                </button>
              </>
            ),
          ])}
        />
      </div>
    </>
  );
}

function Expenses({ rows, admin, add, edit, remove }) {
  const [cottageFilter, setCottageFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
const [fromDate, setFromDate] = useState('');
const [toDate, setToDate] = useState('');
  const filteredRows = rows.filter(x => {
    const cottageMatch =
  cottageFilter === 'all' ||
  (cottageFilter === 'combined' &&
    ['standard', 'luxury', 'superior', 'premier'].includes(x.cottage_id)) ||
  x.cottage_id === cottageFilter;

    const categoryMatch =
      categoryFilter === 'all' || x.category === categoryFilter;
const fromDateMatch =
  !fromDate || x.expense_date >= fromDate;

const toDateMatch =
  !toDate || x.expense_date <= toDate;
    return cottageMatch && categoryMatch && fromDateMatch && toDateMatch;
  });
const filteredTotal = filteredRows.reduce(
  (sum, x) => sum + Number(x.amount || 0),
  0
);
  return (
    <>
      <div className="actions">
        <h2>Guest House Expenses</h2>
        {admin && (
          <button className="btn primary" onClick={add}>
            Add Expense
          </button>
        )}
      </div>
<div className="filters">
  <select
    value={cottageFilter}
    onChange={e => setCottageFilter(e.target.value)}
  >
    <option value="all">All Cottages</option>
    <option value="combined">All Cottages Combined</option>
    <option value="standard">Standard Cottage</option>
    <option value="luxury">Luxury Cottage</option>
    <option value="superior">Superior Cottage</option>
    <option value="premier">Premier Cottage</option>
    <option value="general">General</option>
  </select>

  <select
    value={categoryFilter}
    onChange={e => setCategoryFilter(e.target.value)}
  >
    <option value="all">All Categories</option>
    {cats.map(c => (
  <option key={c} value={c}>
    {c}
  </option>
))}
  </select>
      <input
  type="date"
  value={fromDate}
  onChange={e => setFromDate(e.target.value)}
  title="From Date"
/>

<input
  type="date"
  value={toDate}
  onChange={e => setToDate(e.target.value)}
  title="To Date"
/>
</div>
    <div style={{ marginTop: '12px', marginBottom: '16px', fontWeight: 'bold' }}>
  Total Spent: {money(filteredTotal)}
</div>
      <div className="panel">
        <Table
          head={['Date', 'Category', 'Cottage', 'Description', 'Amount', '']}
          rows={filteredRows.map(x => [
            x.expense_date,
            x.category,
            cottages.find(c => c[0] === x.cottage_id)?.[1] || 'General',
            x.description,
            money(x.amount),
            admin && (
              <>
                <button className="btn" onClick={() => edit(x)}>
                  Edit
                </button>
                <button className="btn danger" onClick={() => remove(x.id)}>
                  Delete
                </button>
              </>
            ),
          ])}
        />
      </div>
    </>
  );
}

function Occupancy({ bookings }) {
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [startMonth, setStartMonth] = useState(thisMonth);
  const [endMonth, setEndMonth] = useState(thisMonth);

  const startDate = `${startMonth}-01`;

  const [endYear, endMo] = endMonth.split('-').map(Number);
  const lastDay = new Date(endYear, endMo, 0).getDate();
  const endDate = `${endMonth}-${String(lastDay).padStart(2, '0')}`;

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  const totalDays =
    Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  let totalOccupied = 0;

  const stats = cottages.map(c => {
    let occupiedNights = 0;

    if (totalDays > 0) {
      for (let d = 0; d < totalDays; d++) {
        const current = new Date(start);
        current.setDate(start.getDate() + d);

        const ds = `${current.getFullYear()}-${String(
          current.getMonth() + 1
        ).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

        if (
          bookings.some(
            b =>
              b.cottage_id === c[0] &&
              b.check_in <= ds &&
              b.check_out > ds
          )
        ) {
          occupiedNights++;
        }
      }
    }

    totalOccupied += occupiedNights;

    return {
      name: c[1],
      nights: occupiedNights,
      percent:
        totalDays > 0 ? (occupiedNights / totalDays) * 100 : 0,
    };
  });

  const combined =
    totalDays > 0
      ? (totalOccupied / (totalDays * cottages.length)) * 100
      : 0;

  return (
    <>
      <h2>Occupancy</h2>

      <div className="panel">
        <h3>Select Period</h3>

        <div className="form-grid">
          <label>
            Start Month
            <input
              type="month"
              value={startMonth}
              max={endMonth}
              onChange={e => setStartMonth(e.target.value)}
            />
          </label>

          <label>
            End Month
            <input
              type="month"
              value={endMonth}
              min={startMonth}
              onChange={e => setEndMonth(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="cards">
        {stats.map(x => (
          <Stat
            key={x.name}
            t={x.name}
            v={`${x.percent.toFixed(1)}%`}
          />
        ))}
      </div>

      <div className="panel">
        <h3>Combined Occupancy</h3>

        <div className="stat">
          <div className="value">
            {combined.toFixed(1)}%
          </div>
        </div>
      </div>
    </>
  );
}

function FinancialSummary({ bookings, payments, restaurant, expenses }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportFor, setReportFor] = useState('all');
const outstandingBookings = bookings
  .map(b => {
    const amountPaid = payments
      .filter(p => p.booking_id === b.id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      ...b,
      outstanding: Math.max(
        0,
        Number(b.total_price || 0) - amountPaid
      ),
    };
  })
  .filter(b => b.outstanding > 0)
  .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
  const inRange = date => {
    if (!date) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  };

  const selectedCottageIds =
    reportFor === 'all' || reportFor === 'combined'
      ? cottages.map(c => c[0])
      : cottages.some(c => c[0] === reportFor)
        ? [reportFor]
        : [];

  const cottageIncome = bookings
    .filter(
      b =>
        selectedCottageIds.includes(b.cottage_id) &&
        inRange(b.check_in)
    )
    .reduce((sum, b) => sum + Number(b.total_price || 0), 0);

  const cottageExpenses = expenses
  .filter(
    e =>
      (
        selectedCottageIds.includes(e.cottage_id) ||
        (
          (reportFor === 'all' || reportFor === 'combined') &&
          !e.cottage_id
        )
      ) &&
      inRange(e.expense_date)
  )
  .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const restaurantIncome =
    reportFor === 'restaurant' || reportFor === 'combined'
      ? restaurant
          .filter(
            x =>
              x.entry_type === 'income' &&
              inRange(x.entry_date)
          )
          .reduce((sum, x) => sum + Number(x.amount || 0), 0)
      : 0;

  const restaurantExpenses =
    reportFor === 'restaurant' || reportFor === 'combined'
      ? restaurant
          .filter(
            x =>
              x.entry_type === 'expense' &&
              inRange(x.entry_date)
          )
          .reduce((sum, x) => sum + Number(x.amount || 0), 0)
      : 0;

  const showCottages =
    reportFor === 'all' ||
    reportFor === 'combined' ||
    cottages.some(c => c[0] === reportFor);

  const showRestaurant =
    reportFor === 'restaurant' || reportFor === 'combined';

  const totalIncome =
    (showCottages ? cottageIncome : 0) +
    (showRestaurant ? restaurantIncome : 0);

  const totalExpenses =
    (showCottages ? cottageExpenses : 0) +
    (showRestaurant ? restaurantExpenses : 0);

  const reportName =
    reportFor === 'all'
      ? 'All Cottages Combined'
      : reportFor === 'restaurant'
        ? 'Restaurant'
        : reportFor === 'combined'
          ? 'Cottages + Restaurant'
          : cottages.find(c => c[0] === reportFor)?.[1] || '';

  return (
    <>
      <h2>Financial Summary</h2>

      <div className="panel">
        <h3>Report Selection</h3>

        <div className="form-grid">
          <label>
            Start Date
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>

          <label>
            End Date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>

          <label>
            Financial Summary For
            <select
              value={reportFor}
              onChange={e => setReportFor(e.target.value)}
            >
              <option value="standard">Standard Cottage</option>
              <option value="luxury">Luxury Cottage</option>
              <option value="superior">Superior Cottage</option>
              <option value="premier">Premier Cottage</option>
              <option value="all">All Cottages Combined</option>
              <option value="restaurant">Restaurant</option>
              <option value="combined">
                Cottages + Restaurant Combined
              </option>
            </select>
          </label>
        </div>

        {(startDate || endDate) && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
          >
            Clear Dates
          </button>
        )}
      </div>

      <div className="panel">
        <h3>{reportName}</h3>

        <div className="cards">
          <Stat
            t="Income"
            v={money(totalIncome)}
          />

          <Stat
            t="Expenses"
            v={money(totalExpenses)}
          />

          <Stat
            t="Profit / Loss"
            v={money(totalIncome - totalExpenses)}
          />
        </div>
      </div>

      {reportFor === 'combined' && (
        <>
          <div className="panel">
            <h3>All Cottages</h3>

            <div className="cards">
              <Stat
                t="Income"
                v={money(cottageIncome)}
              />

              <Stat
                t="Expenses"
                v={money(cottageExpenses)}
              />

              <Stat
                t="Profit / Loss"
                v={money(cottageIncome - cottageExpenses)}
              />
            </div>
          </div>

          <div className="panel">
            <h3>Restaurant</h3>

            <div className="cards">
              <Stat
                t="Income"
                v={money(restaurantIncome)}
              />

              <Stat
                t="Expenses"
                v={money(restaurantExpenses)}
              />

              <Stat
                t="Profit / Loss"
                v={money(
                  restaurantIncome - restaurantExpenses
                )}
              />
            </div>
          </div>
        </>
      )}
  <div className="panel">
  <h3>Outstanding Payments</h3>

  <Table
    head={['Guest', 'Amount Outstanding', 'Check-in', 'Check-out']}
    rows={outstandingBookings.map(b => [
      b.guest_name,
      money(b.outstanding),
      b.check_in,
      b.check_out,
    ])}
  />
</div>
    </>
  );
}

function Table({ head, rows, rowStyles = [] }) {
  return (
    <table>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.length ? (
          rows.map((r, i) => (
            <tr key={i} style={rowStyles[i] || {}}>
              {r.map((x, j) => (
                <td key={j}>{x}</td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={head.length}>No entries yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Modal({ modal, close, reload, setErr }) {
  if (modal.type === 'booking') {
    return (
      <BookingForm
        item={modal.x}
        close={close}
        reload={reload}
        setErr={setErr}
      />
    );
  }

  if (modal.type === 'payment') {
    return (
      <PaymentForm
        booking={modal.x}
        close={close}
        reload={reload}
        setErr={setErr}
      />
    );
  }

  if (modal.type === 'restaurant') {
    return (
      <RestaurantForm
        item={modal.x}
        close={close}
        reload={reload}
        setErr={setErr}
      />
    );
  }

  if (modal.type === 'expense') {
    return (
      <ExpenseForm
        item={modal.x}
        close={close}
        reload={reload}
        setErr={setErr}
      />
    );
  }

  return null;
}

function BookingForm({ item, close, reload, setErr }) {
  const [form, setForm] = useState({
    guest_name: item?.guest_name || '',
    phone: item?.phone || '',
    cottage_id: item?.cottage_id || 'standard',
    guests: item?.guests || 1,
    check_in: item?.check_in || '',
    check_out: item?.check_out || '',
    total_price: item?.total_price || '',
    notes: item?.notes || '',
  });

  async function save(e) {
    e.preventDefault();

    const query = item
      ? supabase.from('bookings').update(form).eq('id', item.id)
      : supabase.from('bookings').insert(form);

    const { error } = await query;

    if (error) {
      setErr(error.message);
      return;
    }

    close();
    reload();
  }

  return (
    <FormShell title={item ? 'Edit Booking' : 'Add Booking'} close={close}>
      <form onSubmit={save}>
        <div className="form-grid">
          <Field
            label="Guest name"
            value={form.guest_name}
            set={v => setForm({ ...form, guest_name: v })}
            required
          />

          <Field
            label="Phone number"
            value={form.phone}
            set={v => setForm({ ...form, phone: v })}
          />

          <label>
            Cottage
            <select
              value={form.cottage_id}
              onChange={e =>
                setForm({ ...form, cottage_id: e.target.value })
              }
            >
              {cottages.map(c => (
                <option key={c[0]} value={c[0]}>
                  {c[1]}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Number of guests"
            type="number"
            value={form.guests}
            set={v => setForm({ ...form, guests: Number(v) })}
            required
          />

          <Field
            label="Check-in"
            type="date"
            value={form.check_in}
            set={v => setForm({ ...form, check_in: v })}
            required
          />

          <Field
            label="Check-out"
            type="date"
            value={form.check_out}
            set={v => setForm({ ...form, check_out: v })}
            required
          />

          <Field
            label="Total price"
            type="number"
            value={form.total_price}
            set={v => setForm({ ...form, total_price: v })}
            required
moneyField
/>

          <Field
            label="Notes"
            value={form.notes}
            set={v => setForm({ ...form, notes: v })}
          />
        </div>

        <SaveButtons close={close} />
      </form>
    </FormShell>
  );
}

function PaymentForm({ booking, close, reload, setErr }) {
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [method, setMethod] = useState('Cash');

  async function save(e) {
    e.preventDefault();

    const { error } = await supabase.from('payments').insert({
      booking_id: booking.id,
      amount,
      paid_on: paidOn,
      method,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    close();
    reload();
  }

  return (
    <FormShell title={`Record Payment — ${booking.guest_name}`} close={close}>
      <form onSubmit={save}>
        <div className="form-grid">
          <Field
  label="Amount"
  type="number"
  value={amount}
  set={setAmount}
  required
  moneyField
/>

          <Field
            label="Payment date"
            type="date"
            value={paidOn}
            set={setPaidOn}
            required
          />

          <label>
            Method
            <select value={method} onChange={e => setMethod(e.target.value)}>
              <option>Cash</option>
              <option>EFT</option>
              <option>Card</option>
              <option>Other</option>
            </select>
          </label>
        </div>

        <SaveButtons close={close} />
      </form>
    </FormShell>
  );
}

function RestaurantForm({ item, close, reload, setErr }) {
  const [form, setForm] = useState({
    entry_date:
      item?.entry_date || new Date().toISOString().slice(0, 10),
    description: item?.description || '',
    entry_type: item?.entry_type || 'income',
    amount: item?.amount || '',
  });

  async function save(e) {
    e.preventDefault();

    const query = item
      ? supabase
          .from('restaurant_transactions')
          .update(form)
          .eq('id', item.id)
      : supabase.from('restaurant_transactions').insert(form);

    const { error } = await query;

    if (error) {
      setErr(error.message);
      return;
    }

    close();
    reload();
  }

  return (
    <FormShell
      title={item ? 'Edit Restaurant Entry' : 'Add Restaurant Entry'}
      close={close}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <Field
            label="Date"
            type="date"
            value={form.entry_date}
            set={v => setForm({ ...form, entry_date: v })}
            required
          />

          <Field
            label="Description"
            value={form.description}
            set={v => setForm({ ...form, description: v })}
            required
          />

          <label>
            Type
            <select
              value={form.entry_type}
              onChange={e =>
                setForm({ ...form, entry_type: e.target.value })
              }
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>

          <Field
            label="Amount"
            type="number"
            value={form.amount}
            set={v => setForm({ ...form, amount: v })}
            required
              moneyField
          />
        </div>

        <SaveButtons close={close} />
      </form>
    </FormShell>
  );
}

function ExpenseForm({ item, close, reload, setErr }) {
  const [form, setForm] = useState({
    expense_date:
      item?.expense_date || new Date().toISOString().slice(0, 10),
    category: item?.category || 'Cleaning',
    cottage_id: item?.cottage_id || '',
    description: item?.description || '',
    amount: item?.amount || '',
  });

  async function save(e) {
    e.preventDefault();

    const payload = {
      ...form,
      cottage_id: form.cottage_id || null,
    };

    const query = item
      ? supabase
          .from('guest_house_expenses')
          .update(payload)
          .eq('id', item.id)
      : supabase.from('guest_house_expenses').insert(payload);

    const { error } = await query;

    if (error) {
      setErr(error.message);
      return;
    }

    close();
    reload();
  }

  return (
    <FormShell
      title={item ? 'Edit Guest House Expense' : 'Add Guest House Expense'}
      close={close}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <Field
            label="Date"
            type="date"
            value={form.expense_date}
            set={v => setForm({ ...form, expense_date: v })}
            required
          />

          <label>
            Category
            <select
              value={form.category}
              onChange={e =>
                setForm({ ...form, category: e.target.value })
              }
            >
              {cats.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            Cottage
            <select
              value={form.cottage_id}
              onChange={e =>
                setForm({ ...form, cottage_id: e.target.value })
              }
            >
              <option value="">General / All</option>

{cottages.map(c => (
                <option value={c[0]} key={c[0]}>
                  {c[1]}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Description"
            value={form.description}
            set={v => setForm({ ...form, description: v })}
            required
          />

          <Field
            label="Amount"
            type="number"
            value={form.amount}
            set={v => setForm({ ...form, amount: v })}
            required
moneyField
/>
        </div>

        <SaveButtons close={close} />
      </form>
    </FormShell>
  );
}

function FormShell({ title, close, children }) {
  return (
    <div className="modal-bg">
      <div className="modal">
        <div className="actions">
          <h2>{title}</h2>
          <button className="btn" onClick={close}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  set,
  type = 'text',
  required = false,
  moneyField = false,
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        required={required}
        step={type === 'number' ? '0.01' : undefined}
        onChange={e => set(e.target.value)}
        onBlur={e => {
          if (moneyField && e.target.value !== '') {
            const number = Number(e.target.value);

            if (!Number.isNaN(number)) {
              set(number.toFixed(2));
            }
          }
        }}
      />
    </label>
  );
}

function SaveButtons({ close }) {
  return (
    <div className="actions" style={{ marginTop: 18 }}>
      <button type="button" className="btn" onClick={close}>
        Cancel
      </button>
      <button type="submit" className="btn primary">
        Save
      </button>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  async function login(e) {
    e.preventDefault();
    setMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setMsg(error.message);
  }

  async function signup() {
    setMsg('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) setMsg(error.message);
    else setMsg('Account created. You can now sign in.');
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1>LUDICKS FARM</h1>
        <p>Management Login</p>
        <small>Secure online access</small>

        <form onSubmit={login}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button type="submit">Sign in</button>
        </form>

        <button type="button" onClick={signup}>
          First setup: create account
        </button>

        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}
