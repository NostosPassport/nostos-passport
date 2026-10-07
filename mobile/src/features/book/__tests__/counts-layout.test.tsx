import { render, screen } from "@testing-library/react-native";
import { Counts } from "../Cover";

describe("passport counts on a narrow phone",()=>{
 it("centers a bounded row with equal flexible columns and keeps long labels inside them",async()=>{
  await render(<Counts counts={{stamps:2,places:1,neighborhoods:1}}/>);
  expect(screen.getByLabelText("2 stamps, 1 places, 1 neighborhoods")).toHaveStyle({alignSelf:"stretch",justifyContent:"center"});
  for(const label of ["STAMPS","PLACES","NEIGHBORHOODS"]){
   expect(screen.getByTestId(`passport-count-${label}`)).toHaveStyle({flex:1,minWidth:0});
   expect(screen.getByText(label,{includeHiddenElements:true}).props.numberOfLines).toBe(1);
   expect(screen.getByText(label,{includeHiddenElements:true}).props.adjustsFontSizeToFit).toBe(true);
  }
 });
});
