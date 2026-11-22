import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';

export const emptyList = [];
export const records = (data, key) => data[key] ?? emptyList;
export const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, {
  dateStyle: 'medium', timeStyle: 'short',
}) : '—';
export const money = (amount, currency) => new Intl.NumberFormat(undefined, {
  style: 'currency', currency,
}).format(amount);
export const status = (value) => value ? value.replaceAll('_', ' ').toLowerCase() : '—';
export const active = (value) => value ? 'Active' : 'Inactive';
export const options = (items, label = 'name') => items.map((item) => [item.id, item[label]]);

export function Panel({ title, description, children, full = false }) {
  return (
    <section className={`work-panel${full ? ' work-panel-full' : ''}`}>
      <h2>{title}</h2>
      {description && <p className="work-muted">{description}</p>}
      {children}
    </section>
  );
}

export function Grid({ children }) {
  return <div className="work-grid">{children}</div>;
}

export function Table({ columns, rows, empty, actions }) {
  if (!rows.length) return <p className="work-empty">{empty}</p>;
  return (
    <div className="work-table-scroll">
      <table className="work-table">
        <thead><tr>{columns.map(([label]) => <th key={label} scope="col">{label}</th>)}{actions && <th scope="col">Actions</th>}</tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            {columns.map(([label, get]) => <td key={label}>{(typeof get === 'function' ? get(row) : row[get]) ?? '—'}</td>)}
            {actions && <td><div className="work-actions">{actions(row)}</div></td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function Field({ name, label, type = 'text', values, optional = false, defaultValue, ...attributes }) {
  return <label className="work-field">
    <span>{label}{optional && <small>Optional</small>}</span>
    {values ? (
      <select name={name} defaultValue={defaultValue ?? ''} required={!optional} {...attributes}>
        <option value="">{optional ? 'None' : 'Choose…'}</option>
        {values.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    ) : type === 'textarea' ? (
      <textarea name={name} defaultValue={defaultValue} required={!optional} rows={4} {...attributes} />
    ) : (
      <input name={name} type={type} defaultValue={defaultValue} required={!optional} {...attributes} />
    )}
  </label>;
}

export function Form({ action, label, submit, busy, children, transform, disabled = false, keepValues = false }) {
  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    if (await submit(action, transform ? transform(fields) : fields) && !keepValues) form.reset();
  }
  return (
    <form className="work-form" onSubmit={onSubmit}>
      <fieldset disabled={busy || disabled}>
        {children}
        <Button type="submit">{label}</Button>
      </fieldset>
    </form>
  );
}

export function WorkspaceLink({ to, children }) {
  return <Link to={to} className="work-link">{children}<ArrowUpRight size={16} aria-hidden="true" /></Link>;
}

export function TermsFields({ platform = false }) {
  return <>
    <Field name="name" label="Tier name" maxLength={120} />
    {!platform && <Field name="days" label="Membership days" type="number" min="1" max="3650" />}
    <Field name="price" label={platform ? 'Monthly price' : 'Price per term'} type="number" step="0.01" min="0" max="9999999999.99" />
    <Field name="currency" label="Currency code" placeholder="INR" maxLength={3} pattern="[A-Za-z]{3}" />
  </>;
}

export function PaymentFields({ optional = false }) {
  return <>
    <Field name="method" label="Payment method" optional={optional} values={[
      ['CASH', 'Cash'], ['CARD_TERMINAL', 'Card terminal'], ['BANK_TRANSFER', 'Bank transfer'], ['OTHER', 'Other'],
    ]} />
    <Field name="reference" label="Receipt or transaction reference" optional={optional} maxLength={120} />
  </>;
}
