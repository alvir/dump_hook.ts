import { createItem, deleteItem, getItems, getTotal } from "./actions";

export default async function Page() {
  const items = await getItems();
  const total = await getTotal();

  return (
    <div>
      <h1>Home</h1>
      <form action={createItem}>
        <input name="title" type="text" placeholder="Title" />
        <button type="submit">Add</button>
      </form>
      <div>
        Showing {items.length} of <span title="total">{total}</span>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id} style={{ display: "flex" }}>
            {item.title}&nbsp;
            <form action={deleteItem.bind(null, item.id)}>
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
