import { useState, useEffect } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { KanbanSettingApi, type SuperCostList } from '@/api/kanbanSetting'
import './ItemCostList.css'


export const ItemsCostList = () => {
  
  const [costList, setCostList] = useState<SuperCostList[]>([]);
  const [loading, setLoading] = useState(true);

  
  useEffect(() => {
    fetchSuperCostList();
  
  }, []);


  const fetchSuperCostList = async () => {
    try {
      setLoading(true);
     
      const data = await KanbanSettingApi.getCostList() ;
      setCostList(data);
    } catch (err: any) {
      console.error('Failed to fetch tickets:', err);
     
    } finally {
      setLoading(false);
    }
  };

const totalGlpi = costList.reduce((acc, item) => acc + item.glpicost, 0);
const totalSuper = costList.reduce((acc, item) => acc + item.supercost, 0);
  



return (
  <div>
    <table>
      <thead>
        <tr>
          <th>Ticket id</th>
          <th>SuperCost</th>
          <th>GlpiCost</th>
          <th>Category</th>
        </tr>
      </thead>

      <tbody>
        {costList.map((item) => (
          <tr key={item.idTicket}>
            <td>{item.idTicket}</td>
            <td>{item.supercost}</td>
            <td>{item.glpicost}</td>
            <td>{item.category}</td>
          </tr>
        ))}<tfoot>
  <tr>
    <td>Total</td>
    <td>{totalSuper}</td>
    <td>{totalGlpi}</td>
    <td></td>
  </tr>
</tfoot>
      </tbody>


    </table>
  </div>
);

}

export default ItemsCostList;
   