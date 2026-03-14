# 🔄 Frontend Refactoring Examples

## Example 1: Student List Management

### ❌ Before (Scattered Logic)
```javascript
function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/students').then(res => {
      setStudents(res.data);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    await api.delete(`/students/${id}`);
    setStudents(students.filter(s => s.id !== id));
  };

  return loading ? <Spinner /> : <Table data={students} onDelete={handleDelete} />;
}
```

### ✅ After (Hooks Based)
```javascript
function StudentList() {
  const { data: students, isLoading } = useStudents();
  const { mutate: deleteStudent } = useDeleteStudent();

  if (isLoading) return <LoadingSpinner />;

  return <StudentTable data={students} onDelete={deleteStudent} />;
}
```

## Example 2: Form Input

### ❌ Before (Ad-hoc styling)
```javascript
<input 
  type="text" 
  className="bg-gray-100 p-2 border border-red-500 rounded" 
  value={name}
  onChange={e => setName(e.target.value)}
/>
{error && <span className="text-red-500">{error}</span>}
```

### ✅ After (Reusable UI)
```javascript
<Input 
  label="Student Name"
  placeholder="Enter name"
  value={name}
  onChange={e => setName(e.target.value)}
  error={error}
/>
```
